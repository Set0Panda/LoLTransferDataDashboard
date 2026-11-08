// Confirmed or rumoured moves that Riot's sheet doesn't show yet. Edit this file, commit, done.
// status: "confirmed" -> player is removed from `from` and slotted into `to` (shown with a CONFIRMED tag)
//         "rumor"     -> a tag on both teams; roster unchanged
// Names must match the contract sheet exactly (team names as on Contract Radar, e.g. "Hanwha Life Esports").
// role is optional (defaults to the player's role on the sheet): TOP | JUNGLE | MID | BOT | SUPPORT
//
// Example (delete the slashes to use):
// {player: "Zeus", from: "Hanwha Life Esports", to: "Gen.G", role: "TOP", status: "rumor", url: "https://...", note: "Sheep Esports, 8 Nov"},
window.ROSTER_OVERRIDES = [
];
