export const ATLANTA_AREAS = [
  "Midtown",
  "Buckhead",
  "Cumming",
  "Sandy Springs",
  "Alpharetta",
  "Marietta",
] as const;

export type AtlantaArea = (typeof ATLANTA_AREAS)[number];

export const APPROVED_ATLANTA_ZIPS = [
  "30004", "30005", "30008", "30009", "30022", "30023", "30028", "30040", "30041", "30060",
  "30062", "30064", "30066", "30067", "30068",
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313",
  "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30328",
  "30329", "30331", "30332", "30334", "30336", "30337", "30338", "30339", "30340", "30341",
  "30342", "30344", "30345", "30349", "30350", "30354", "30360", "30363",
] as const;

export type ApprovedAtlantaZip = (typeof APPROVED_ATLANTA_ZIPS)[number];
