/** The change request's test viewports (section 6). */
export const VIEWPORTS = [
  { name: "phone-360x800", width: 360, height: 800, mobile: true },
  { name: "phone-375x667", width: 375, height: 667, mobile: true },
  { name: "phone-390x844", width: 390, height: 844, mobile: true },
  { name: "phone-430x932", width: 430, height: 932, mobile: true },
  { name: "landscape-844x390", width: 844, height: 390, mobile: true },
  { name: "tablet-768x1024", width: 768, height: 1024, mobile: true },
  { name: "tablet-1024x768", width: 1024, height: 768, mobile: true },
  { name: "desktop-1280x720", width: 1280, height: 720, mobile: false },
  { name: "desktop-1366x768", width: 1366, height: 768, mobile: false },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false },
  { name: "desktop-1920x1080", width: 1920, height: 1080, mobile: false },
  { name: "desktop-2560x1440", width: 2560, height: 1440, mobile: false },
] as const;
