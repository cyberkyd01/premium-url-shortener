export const DEVICE_OPTIONS = [
  { value: "mobile", label: "Mobile" }, { value: "tablet", label: "Tablet" }, { value: "desktop", label: "Desktop" },
  { value: "iphone", label: "iPhone" }, { value: "ipad", label: "iPad" }, { value: "android", label: "Android" },
  { value: "windows", label: "Windows" }, { value: "mac", label: "macOS" }, { value: "linux", label: "Linux" },
];

export const LANGUAGE_OPTIONS = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["it", "Italian"], ["pt", "Portuguese"], ["nl", "Dutch"], ["ru", "Russian"],
  ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"], ["ar", "Arabic"], ["hi", "Hindi"], ["tr", "Turkish"], ["pl", "Polish"], ["sv", "Swedish"],
  ["da", "Danish"], ["fi", "Finnish"], ["no", "Norwegian"], ["cs", "Czech"], ["el", "Greek"], ["he", "Hebrew"], ["id", "Indonesian"], ["th", "Thai"],
  ["vi", "Vietnamese"], ["uk", "Ukrainian"], ["ro", "Romanian"], ["hu", "Hungarian"], ["ms", "Malay"], ["fa", "Persian"], ["bn", "Bengali"], ["ur", "Urdu"],
].map(([value, label]) => ({ value, label }));

export const RULE_FIELDS = [
  { value: "country", label: "Country (ISO2)" }, { value: "region", label: "Region / state" }, { value: "city", label: "City" },
  { value: "device", label: "Device (mobile/tablet/desktop)" }, { value: "os", label: "Operating system" }, { value: "browser", label: "Browser" },
  { value: "language", label: "Language" }, { value: "referer", label: "Referrer host" }, { value: "ip", label: "IP address" },
  { value: "hour", label: "Hour (UTC 0-23)" }, { value: "day", label: "Weekday (0=Sun)" }, { value: "inapp", label: "In-app browser" }, { value: "bot", label: "Is bot (1/0)" },
  { value: "param:", label: "Query parameter (param:name)" },
];

export const RULE_OPS = [
  { value: "eq", label: "equals" }, { value: "neq", label: "not equals" }, { value: "in", label: "in list (a,b,c)" }, { value: "nin", label: "not in list" },
  { value: "contains", label: "contains" }, { value: "starts", label: "starts with" }, { value: "gt", label: "greater than" }, { value: "lt", label: "less than" }, { value: "exists", label: "exists" },
];

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TIMEZONES = ["UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Istanbul", "Europe/Moscow", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "America/Mexico_City", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland", "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg"];

export const REDIRECT_TYPES = [
  { value: "direct", label: "Direct", hint: "Instant 302 redirect" },
  { value: "frame", label: "Frame", hint: "Top bar with branding over the destination" },
  { value: "splash", label: "Splash", hint: "Preview page with countdown" },
  { value: "custom", label: "Custom splash", hint: "Your own designed splash page" },
  { value: "overlay", label: "Overlay", hint: "Destination with a widget on top" },
];

export const STATS_PERIODS = [7, 30, 90, 365];
