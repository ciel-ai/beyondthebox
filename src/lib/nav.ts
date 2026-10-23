export const NAV_LINKS = [
  { label: "Programme", href: "/#programme" },
  { label: "Speakers", href: "/#speakers" },
  { label: "Awards", href: "/#awards" },
  { label: "Tickets", href: "/#tickets" },
  { label: "Sponsors", href: "/#sponsors" },
  { label: "Contact", href: "/#contact" },
];

/** Non-home routes that map to a nav item. */
export const ROUTE_TO_NAV: Record<string, string> = {
  "/speakers": "/#speakers",
  "/tickets": "/#tickets",
  "/awards": "/#awards",
  "/awards/nominate": "/#awards",
};
