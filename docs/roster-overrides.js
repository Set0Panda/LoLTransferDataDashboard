// Confirmed or rumoured moves that Riot's sheet doesn't show yet. Edit this file, commit, done.
// status: "confirmed" -> player is removed from `from` and slotted into `to` (shown with a CONFIRMED tag)
//         "rumor"     -> a tag on both teams; roster unchanged
// Names must match the contract sheet exactly (team names as on Contract Radar, e.g. "Hanwha Life Esports").
// role is optional (defaults to the player's role on the sheet): TOP | JUNGLE | MID | BOT | SUPPORT
//
// Example (delete the slashes to use):
// {player: "Zeus", from: "Hanwha Life Esports", to: "Gen.G", role: "TOP", status: "rumor", url: "https://...", note: "Sheep Esports, 8 Nov"},
window.ROSTER_OVERRIDES = [
{player: "TheShy", from: "", to: "Invictus Gaming", role: "TOP", status: "confirmed", url: "https://www.sheepesports.com/pt/articles/invictus-gaming-announce-the-return-of-theshy-for-the-lpl-split-3/en", note: "IG announced his return for LPL Split 3, 15 Jun 2026"},
{player: "Soboro", from: "Invictus Gaming", status: "confirmed", url: "https://rft.gg/news/theshy-invictus-gaming-lpl-split-3", note: "Left IG with Nia and Breathe, 15 Jun 2026; the CN sheet predates this"},
];
