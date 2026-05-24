const MERMAID_FENCE_PATTERN = /```mermaid([^\n`]*)\n([\s\S]*?)```/g

const MERMAID_DIAGRAM_START_PATTERN =
  /^(?:---[\s\S]*?---\s*)?(?:architecture|block-beta|c4context|classDiagram|erDiagram|flowchart|gantt|gitGraph|graph|journey|mindmap|packet-beta|pie|quadrantChart|requirementDiagram|sankey-beta|sequenceDiagram|stateDiagram(?:-v2)?|timeline|xychart-beta)\b/i

const ARROW_PATTERN = /\s*(?:-->|->|=>|→|⇒)\s*/u

interface OutlineFrame {
  indent: number
  nodeId: string
}

interface OutlineNode {
  id: string
  label: string
}

/**
 * Normalizes fenced Mermaid blocks before Streamdown renders them.
 *
 * @remarks
 * Agents sometimes label an indented arrow outline as `mermaid` without a
 * diagram declaration such as `flowchart TD`. Mermaid cannot parse that raw
 * outline, so we convert the outline to a small flowchart when the shape is
 * unambiguous and leave all real Mermaid diagrams untouched.
 */
export function normalizeMermaidCodeBlocks(markdown: string): string {
  return markdown.replace(MERMAID_FENCE_PATTERN, (_match, meta: string, source: string) => {
    const trimmed = source.trim()
    if (!trimmed || MERMAID_DIAGRAM_START_PATTERN.test(trimmed)) {
      return `\`\`\`mermaid${meta}\n${source}\`\`\``
    }

    const flowchart = convertArrowOutlineToFlowchart(source)
    if (!flowchart) return `\`\`\`mermaid${meta}\n${source}\`\`\``

    const fenceBody = flowchart.endsWith('\n') ? flowchart : `${flowchart}\n`
    return `\`\`\`mermaid${meta}\n${fenceBody}\`\`\``
  })
}

function convertArrowOutlineToFlowchart(source: string): string | null {
  const nodes: OutlineNode[] = []
  const edges: string[] = []
  const stack: OutlineFrame[] = []

  for (const rawLine of source.split(/\r?\n/)) {
    if (!rawLine.trim()) continue

    const line = rawLine.replaceAll('\t', '  ').trimEnd()
    const indent = line.length - line.trimStart().length
    const parts = line.trim().split(ARROW_PATTERN).filter(Boolean)
    if (parts.length === 0) continue

    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop()
    }

    const nodeIds = parts.map((part) => addNode(nodes, part))
    const parent = stack.at(-1)?.nodeId
    if (parent) edges.push(`${parent} --> ${nodeIds[0]}`)

    for (let index = 1; index < nodeIds.length; index += 1) {
      edges.push(`${nodeIds[index - 1]} --> ${nodeIds[index]}`)
    }

    stack.push({ indent, nodeId: nodeIds[nodeIds.length - 1]! })
  }

  if (nodes.length < 2 || edges.length === 0) return null

  const declarations = nodes.map((node) => `  ${node.id}["${escapeMermaidLabel(node.label)}"]`)
  const connections = Array.from(new Set(edges)).map((edge) => `  ${edge}`)
  return ['flowchart TD', ...declarations, ...connections].join('\n')
}

function addNode(nodes: OutlineNode[], label: string): string {
  const id = `n${nodes.length}`
  nodes.push({ id, label: label.trim() })
  return id
}

function escapeMermaidLabel(label: string): string {
  return label.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
