const esc = (s: string) =>
  s.replace(/&/g, "&")
   .replace(/</g, "<")
   .replace(/>/g, ">")
   .replace(/"/g, """)
   .replace(/'/g, "&#39;");