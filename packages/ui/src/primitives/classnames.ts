export function cx(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(" ");
}
