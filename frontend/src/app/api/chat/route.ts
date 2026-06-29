import { groq } from '@ai-sdk/groq';
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import { registry } from '@/registry';
import { z } from 'zod';

export const maxDuration = 30;
export const revalidate = false;

const getComponentCode = async (item: any) => {
  if (!item || !item.files || item.files.length === 0) {
    return null;
  }

  const filePath = item.files[0].path;
  const normalizedPath = filePath.replace(/^@\//, '').replace(/^\//, '');
  const fullPath = path.join(process.cwd(), normalizedPath);

  try {
    const code = await fs.readFile(fullPath, 'utf-8');

    return {
      name: item.name,
      type: item.type,
      path: filePath,
      code: code,
      dependencies: item.dependencies || [],
      registryDependencies: item.registryDependencies || [],
      link: `https://blocks.mvp-subha.me/r/${item.name}.json`,
      installCommand: `npx mvpblocks add ${item.name}`,
    };
  } catch (error) {
    console.error(`Error reading file ${fullPath}:`, error);
    return null;
  }
};

const findSimilarComponents = (name: string, maxResults = 5) => {
  const searchTerm = name.toLowerCase();

  const typeDescriptions = {
    'registry:block': 'Block Component',
    'registry:ui': 'UI Component',
    'registry:hook': 'Hook',
    'registry:lib': 'Utility Library',
  };

  const extractCategories = () => {
    const categories = new Set<string>();

    registry.forEach((item) => {
      const nameParts = item.name.split(/[-_]/);
      nameParts.forEach((part) => {
        if (part.length > 3) {
          categories.add(part.toLowerCase());
        }
      });

      if (item.files && item.files.length > 0) {
        const pathParts = item.files[0].path.split(/[\/\\]/);
        pathParts.forEach((part) => {
          if (part.length > 3 && !part.includes('.')) {
            categories.add(part.toLowerCase());
          }
        });
      }

      if (item.categories) {
        item.categories.forEach((category) => {
          categories.add(category.toLowerCase());
        });
      }
    });

    return Array.from(categories);
  };

  const allCategories = extractCategories();

  const matchingCategories = allCategories.filter(
    (category) =>
      searchTerm.includes(category) || category.includes(searchTerm),
  );

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.includes(s2)) return 0.9;
    if (s2.includes(s1)) return 0.8;

    const isAbbreviation = (short: string, long: string): boolean => {
      if (short.length >= long.length) return false;

      let shortIndex = 0;
      for (let i = 0; i < long.length && shortIndex < short.length; i++) {
        if (short[shortIndex] === long[i]) {
          shortIndex++;
        }
      }

      return shortIndex === short.length;
    };

    if (isAbbreviation(s1, s2)) return 0.7;
    if (isAbbreviation(s2, s1)) return 0.6;

    let commonChars = 0;
    for (const char of s1) {
      if (s2.includes(char)) commonChars++;
    }

    return (commonChars / Math.max(s1.length, s2.length)) * 0.5;
  };

  const componentsWithScores = registry.map((item) => {
    const itemName = item.name.toLowerCase();
    const itemPath =
      item.files && item.files.length > 0
        ? item.files[0].path.toLowerCase()
        : '';

    const nameSimilarity = calculateSimilarity(searchTerm, itemName);
    const pathSimilarity = itemPath
      ? calculateSimilarity(searchTerm, itemPath)
      : 0;
    const categoryMatch = matchingCategories.some(
      (category) =>
        itemName.includes(category) ||
        (itemPath && itemPath.includes(category)),
    );
    const score =
      nameSimilarity * 10 + pathSimilarity * 5 + (categoryMatch ? 3 : 0);

    return {
      item,
      score,
      hasMatch: score > 0,
    };
  });

  const results = componentsWithScores
    .filter(({ hasMatch }) => hasMatch)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ item }) => ({
      name: item.name,
      type:
        typeDescriptions[item.type as keyof typeof typeDescriptions] ||
        item.type,
      path: item.files && item.files.length > 0 ? item.files[0].path : null,
      dependencies: item.dependencies || [],
      registryDependencies: item.registryDependencies || [],
      link: `https://blocks.mvp-subha.me/r/${item.name}.json`,
    }));

  return results.length > 0 ? results : null;
};

// Build a categorized index of every component in the registry. Computed once
// at module load and inlined into the system prompt so the model NEVER has to
// guess a name (the source of past hallucinations like "Mockup hero").
const buildComponentIndex = () => {
  const groups = new Map<string, string[]>();
  for (const item of registry) {
    let bucket = 'misc';
    if (item.type === 'registry:ui') bucket = 'ui';
    else if (item.type === 'registry:hook') bucket = 'hooks';
    else if (item.type === 'registry:lib') bucket = 'lib';
    else {
      const path = item.files?.[0]?.path ?? '';
      // /components/mvpblocks/<group>/<sub>/<file>.tsx -> use <group>
      const match = path.match(/components\/mvpblocks\/([^/]+)\//);
      bucket = match ? `blocks/${match[1]}` : 'blocks/misc';
    }
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(item.name);
  }
  const sortedKeys = Array.from(groups.keys()).sort();
  return sortedKeys
    .map((key) => {
      const names = groups.get(key)!.sort();
      return `${key} (${names.length}): ${names.join(', ')}`;
    })
    .join('\n');
};
const COMPONENT_INDEX = buildComponentIndex();
const COMPONENT_COUNT = registry.length;

const createSystemPrompt = () =>
  `You are **mvp.ai**, the official AI assistant for MVPBlocks (open-source UI library, Next.js + TailwindCSS + Framer Motion).

# HARD RULES (violations break the user's app)

1. **NEVER invent component names.** Every name you mention MUST be in the AVAILABLE COMPONENTS index below. If you cannot find a fit, search/list with a tool first.
2. **ALWAYS call a tool before naming, describing, or coding any component.** Call \`fetchComponent\` for a specific name, \`searchComponents\` for a keyword, or \`listComponents\` to browse a type/category. Do not answer from memory.
3. **Install commands MUST come from tool output verbatim.** Use the \`installCommand\` field exactly. Never construct your own.
4. **Code MUST come from tool output verbatim.** Use the \`code\` field. Never re-type, paraphrase, or invent component code.
5. **Import paths MUST use \`@/components/...\` direct paths** (this is NOT an npm package).
6. **Show every tool call** by actually calling the tool — do not summarize what a tool "would" return.

# AVAILABLE COMPONENTS (${COMPONENT_COUNT} total, use exactly these names)

${COMPONENT_INDEX}

# TOOLS

- \`fetchComponent({ name })\` — get a single component's full source code, deps, install command, and link. **Use first when the user names a specific component.**
- \`searchComponents({ keyword })\` — find components by keyword (e.g. "hero", "pricing", "loader"). **Use when the user describes intent without a name.** Returns top 5 ranked matches.
- \`listComponents({ type, category? })\` — browse by type (\`ui\` | \`block\` | \`hook\` | \`lib\` | \`all\`) optionally filtered by category. **Use to give an overview or compare options.**
- \`getDependencyCode({ url })\` — fetch the code of a registry-dependency referenced by a component (use after fetchComponent when a result lists registryDependencies the user needs).
- \`generateComponent({ componentName, componentType, buildingBlocks })\` — gather building-block code for composing a NEW component the user wants.

# WORKFLOWS

**"Show me X" / "How do I use X?"** where X is a component name:
1. \`fetchComponent({ name: X })\`
2. If not found, \`searchComponents({ keyword: X })\` and tell the user the closest matches.
3. Present: brief description (≤2 sentences) → install command (verbatim) → import path → usage example → props (from \`code\`) → registry deps if any.

**"What's the best X?" / "Suggest a X"** without a name:
1. \`searchComponents({ keyword: <intent> })\` OR \`listComponents({ type: 'block', category: <intent> })\`.
2. List the top 3 with one line each.
3. Ask the user which one they want, then \`fetchComponent\` for that one.

**"Build me a Y"** (composition request):
1. \`searchComponents\` for the building blocks (button, input, card, etc.).
2. \`fetchComponent\` each chosen block to get its real code/import path.
3. Synthesise a NEW component that imports the real blocks from \`@/components/...\` and adds the glue logic.
4. List the \`installCommand\`s for every block used (each from tool output).
5. Output the new component as a complete, copy-pastable code block.

# OUTPUT FORMAT

- Markdown with fenced \`tsx\` code blocks.
- One concise sentence before each code block.
- No emojis unless mid-sentence for emphasis (this is a docs assistant, not a chat toy).
- Indent with 2 spaces in code blocks.
- If a request is off-topic (not about MVPBlocks), politely redirect in one sentence.`;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const systemPrompt = createSystemPrompt();

    const result = streamText({
      model: groq('openai/gpt-oss-120b'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxRetries: 3,
      stopWhen: stepCountIs(10),
      tools: {
        fetchComponent: tool({
          description:
            'Fetch the required component asked by the user from the registry',
          inputSchema: z.object({
            name: z.string().describe('The name of the component to fetch'),
          }),
          execute: async ({ name }) => {
            const component = registry.find((item) => item.name === name);

            if (component) {
              // Get the component code
              const componentWithCode = await getComponentCode(component);
              return componentWithCode
                ? JSON.stringify(componentWithCode)
                : null;
            } else {
              // If component not found, find similar components
              const similarComponents = findSimilarComponents(name);
              return JSON.stringify({
                found: false,
                message: `Component "${name}" not found.`,
                similarComponents,
              });
            }
          },
        }),
        searchComponents: tool({
          description: 'Search for components by keyword',
          inputSchema: z.object({
            keyword: z.string().describe('The keyword to search for'),
          }),
          execute: async ({ keyword }) => {
            const similarComponents = findSimilarComponents(keyword);
            return JSON.stringify({
              results: similarComponents || [],
              message: similarComponents
                ? `Found ${similarComponents.length} components matching "${keyword}".`
                : `No components found matching "${keyword}".`,
            });
          },
        }),
        getDependencyCode: tool({
          description: 'Get the code for a registry dependency',
          inputSchema: z.object({
            url: z
              .string()
              .describe('The URL of the registry dependency to fetch'),
          }),
          execute: async ({ url }) => {
            try {
              // Extract component name from URL
              const componentName = url.split('/').pop()?.replace('.json', '');

              if (!componentName) {
                return JSON.stringify({
                  error: 'Invalid URL format',
                  message: 'Could not extract component name from URL',
                });
              }

              // Find the component in the registry
              const component = registry.find(
                (item) => item.name === componentName,
              );

              if (!component) {
                return JSON.stringify({
                  error: 'Component not found',
                  message: `Component "${componentName}" not found in the registry`,
                });
              }

              // Get the component code
              const componentWithCode = await getComponentCode(component);

              return componentWithCode
                ? JSON.stringify({
                    component: componentWithCode,
                    message: `Successfully retrieved code for dependency "${componentName}"`,
                  })
                : JSON.stringify({
                    error: 'Code not found',
                    message: `Could not retrieve code for component "${componentName}"`,
                  });
            } catch (error) {
              console.error('Error fetching dependency code:', error);
              return JSON.stringify({
                error: 'Failed to fetch dependency',
                message: 'An error occurred while fetching the dependency code',
              });
            }
          },
        }),
        generateComponent: tool({
          description:
            'Generate a new component by combining existing components',
          inputSchema: z.object({
            componentName: z
              .string()
              .describe('The name of the component to generate'),
            componentType: z
              .string()
              .describe(
                'The type of component to generate (e.g., chatbot, form, card)',
              ),
            buildingBlocks: z
              .array(z.string())
              .describe('Array of component names to use as building blocks'),
          }),
          execute: async ({ componentName, componentType, buildingBlocks }) => {
            try {
              // Get the building block components
              const components = await Promise.all(
                buildingBlocks.map(async (name) => {
                  const component = registry.find((item) => item.name === name);
                  if (!component) return null;
                  return await getComponentCode(component);
                }),
              );

              // Filter out null components
              const validComponents = components.filter((c) => c !== null);

              // Get all dependencies from the building blocks
              const allDependencies = new Set<string>();
              const allRegistryDependencies = new Set<string>();

              validComponents.forEach((component) => {
                if (component?.dependencies) {
                  component.dependencies.forEach((dep: string) =>
                    allDependencies.add(dep),
                  );
                }
                if (component?.registryDependencies) {
                  component.registryDependencies.forEach((dep: string) =>
                    allRegistryDependencies.add(dep),
                  );
                }
              });

              return JSON.stringify({
                componentName,
                componentType,
                buildingBlocks: validComponents,
                dependencies: Array.from(allDependencies),
                registryDependencies: Array.from(allRegistryDependencies),
                message: `Generated component information for "${componentName}" of type "${componentType}" using ${validComponents.length} building blocks.`,
              });
            } catch (error) {
              console.error('Error generating component:', error);
              return JSON.stringify({
                error: 'Failed to generate component',
                message: 'An error occurred while generating the component',
              });
            }
          },
        }),
        listComponents: tool({
          description: 'List all components by type or category',
          inputSchema: z.object({
            type: z
              .enum(['ui', 'block', 'hook', 'lib', 'all'])
              .describe(
                'The type of components to list: ui, block, hook, lib, or all',
              ),
            category: z
              .string()
              .optional()
              .describe(
                'Optional category to filter by (e.g., buttons, loaders, cards)',
              ),
          }),
          execute: async ({ type, category }) => {
            // Helper function to extract categories from a component
            const extractComponentCategories = (item: any): string[] => {
              const categories = new Set<string>();

              // Extract from component name
              const nameParts = item.name.split(/[-_]/);
              nameParts.forEach((part: string) => {
                if (part.length > 3) {
                  categories.add(part.toLowerCase());
                }
              });

              // Extract from file path
              if (item.files && item.files.length > 0) {
                const path = item.files[0].path;

                // Extract directory structure as categories
                const pathParts = path.split(/[\/\\]/);
                pathParts.forEach((part: string) => {
                  if (part.length > 3 && !part.includes('.')) {
                    categories.add(part.toLowerCase());
                  }
                });

                // Special handling for common patterns in paths
                if (path.includes('buttons')) categories.add('button');
                if (path.includes('loaders')) categories.add('loader');
                if (path.includes('cards')) categories.add('card');
                if (path.includes('forms')) categories.add('form');
                if (path.includes('inputs')) categories.add('input');
                if (path.includes('modals') || path.includes('dialogs'))
                  categories.add('dialog');
                if (path.includes('navigation')) categories.add('nav');
              }

              // Add explicit categories if available
              if (item.categories) {
                item.categories.forEach((cat: string) => {
                  categories.add(cat.toLowerCase());
                });
              }

              return Array.from(categories);
            };

            let filteredComponents = [...registry];

            // Filter by type if not 'all'
            if (type !== 'all') {
              const typeMapping: Record<string, string> = {
                ui: 'registry:ui',
                block: 'registry:block',
                hook: 'registry:hook',
                lib: 'registry:lib',
              };

              filteredComponents = filteredComponents.filter(
                (item) => item.type === typeMapping[type],
              );
            }

            // Filter by category if provided
            if (category) {
              const categoryLower = category.toLowerCase();

              filteredComponents = filteredComponents.filter((item) => {
                // Get all categories for this component
                const componentCategories = extractComponentCategories(item);

                // Check if any category matches
                if (
                  componentCategories.some(
                    (cat) =>
                      cat.includes(categoryLower) ||
                      categoryLower.includes(cat),
                  )
                ) {
                  return true;
                }

                // Additional check for name and path
                const itemName = item.name.toLowerCase();
                const itemPath = item.files?.[0]?.path?.toLowerCase() || '';

                return (
                  itemName.includes(categoryLower) ||
                  categoryLower.includes(itemName) ||
                  itemPath.includes(categoryLower)
                );
              });
            }

            // Enhance components with detected categories
            const components = filteredComponents.map((item) => {
              const detectedCategories = extractComponentCategories(item);

              return {
                name: item.name,
                type: item.type,
                path: item.files?.[0]?.path || null,
                categories: detectedCategories,
                link: `https://blocks.mvp-subha.me/r/${item.name}.json`,
                installCommand: `npx mvpblocks add ${item.name}`,
                dependencies: item.dependencies || [],
                registryDependencies: item.registryDependencies || [],
              };
            });

            // Group by type for better organization
            const groupedByType: Record<string, any[]> = {
              'registry:ui': [],
              'registry:block': [],
              'registry:hook': [],
              'registry:lib': [],
            };

            components.forEach((component) => {
              if (groupedByType[component.type]) {
                groupedByType[component.type].push(component);
              }
            });

            // Sort each group alphabetically by name
            Object.keys(groupedByType).forEach((key) => {
              groupedByType[key].sort((a, b) => a.name.localeCompare(b.name));
            });

            // If category is provided, also group by detected categories
            let groupedByCategory: Record<string, any[]> | null = null;
            if (category) {
              groupedByCategory = {} as Record<string, any[]>;

              components.forEach((component) => {
                component.categories.forEach((cat) => {
                  if (!groupedByCategory![cat]) {
                    groupedByCategory![cat] = [];
                  }
                  groupedByCategory![cat].push(component);
                });
              });

              // Sort categories and components within categories
              Object.keys(groupedByCategory).forEach((cat) => {
                groupedByCategory![cat].sort((a: any, b: any) =>
                  a.name.localeCompare(b.name),
                );
              });
            }

            return JSON.stringify({
              total: components.length,
              components: type === 'all' ? groupedByType : components,
              categorized: groupedByCategory,
              message: `Found ${components.length} ${type} components${category ? ` in category "${category}"` : ''}.`,
            });
          },
        }),
      },
      experimental_transform: smoothStream({
        chunking: 'word',
      }),
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    console.error('Unhandled error in chat API:', error);
    throw error;
  }
}
