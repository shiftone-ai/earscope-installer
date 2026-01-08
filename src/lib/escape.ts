export function escapePowerShellString(str: string): string {
  return str.replace(/'/g, "''");
}
