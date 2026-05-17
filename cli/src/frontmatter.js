import YAML from 'yaml';

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parse(source) {
  const m = source.match(FENCE);
  if (!m) return { data: {}, body: source };
  const data = YAML.parse(m[1]) ?? {};
  return { data, body: m[2] ?? '' };
}

export function serialize(data, body) {
  const yaml = YAML.stringify(data).trimEnd();
  const sep = body.startsWith('\n') ? '' : '\n';
  return `---\n${yaml}\n---${sep}${body}`;
}

export function patch(source, patchObj) {
  const { data, body } = parse(source);
  const merged = { ...data, ...patchObj };
  return serialize(merged, body);
}
