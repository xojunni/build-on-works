/** Apply only to manifest-identified generated jobs; never to user-authored descriptions. */
export function cleanGeneratedJobDescription(description: string | null) {
  if (description === null) return null;
  return description
    .replace(/^\s*\[졸업 시연용 가상[^\]]*\]\s*/, "")
    .replace(/(?:\n|\s)*시나리오:\s*graduation-[\s\S]*$/, "")
    .trim();
}
