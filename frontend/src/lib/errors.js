export function flattenApiErrors(error, _field = null) {
  if (!error) {
    return "Request failed.";
  }

  if (error.errors && typeof error.errors === "object") {
    return Object.entries(error.errors)
      .flatMap(([_field, messages]) => {
        const list = Array.isArray(messages) ? messages : [String(messages)];
        return list.map((msg) => String(msg));
      })
      .join(" ");
  }

  return error.message || "Request failed.";
}
