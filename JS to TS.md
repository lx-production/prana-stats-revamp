Perfect. Keep it minimal and do it in this order:

1. **Set the boundary first (what stays JS for now)**
- Keep these as JS initially: `scripts/`, `server/`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`.
- Convert only **app runtime code** first: `components/`, `hooks/`, `utils/`, `constants/`, entry files.

2. **Enable TypeScript checks (one-time setup)**
- Add `tsconfig.json` and `vite-env.d.ts`.
- Add type deps: `@types/react`, `@types/react-dom`, and usually `typescript`.
- Add a script like `typecheck` so you can run checks anytime.

3. **Convert app entry files first**
- Rename `main.jsx` -> `main.tsx`.
- Then convert UI entry/support files used at runtime: `hero3.jsx`, `shader.jsx` (if easy), `hooks/useSpinningFavicon.js`, `spinningFavicon.js`.

4. **Convert JS hooks used by TS components**
- Prioritize hooks imported by TSX pages/components.
- In your repo, good candidates are JS hooks under `hooks/` that power stats/bonds screens.
- Rule: when converting a hook, put its parameter/return types in a separate types file (or shared `types` module), not inline everywhere.

5. **Keep components mostly display-only**
- For large components like `components/PranaStats.tsx`, move derived/calculation logic into hook files (for example a `usePranaStatsViewModel` style hook).
- Component should mainly render props/state from hooks.

6. **Extract reusable logic into utils**
- Any repeated formatting/calculation/parsing logic should go to `utils/` (you already do this in several places; keep following that pattern).
- Keep business math out of JSX.

7. **Convert constants used by app code**
- Move JS constants consumed by TS code into `.ts` (`constants/*.js` -> `.ts`) to remove type gaps.
- Leave constants used only by Node scripts for later.

8. **Migrate gradually, file-by-file**
- Use this rule: “when touching a JS runtime file, convert it to TS/TSX.”
- Don’t do big-bang migration.

9. **Final cleanup phase (later)**
- After app runtime is stable in TS, decide whether to convert `scripts/` and `server/` too.
- If not converting, keep them JS with lightweight JSDoc types.

If you want, I can give you the **exact first 5 files** to convert this week (lowest risk, highest consistency impact).

Start with these exact 5, in this order:

1. `main.jsx` -> `main.tsx`  
2. `hooks/useSpinningFavicon.js` -> `hooks/useSpinningFavicon.ts`  
3. `spinningFavicon.js` -> `spinningFavicon.ts`  
4. `hero3.jsx` -> `hero3.tsx`  
5. `shader.jsx` -> `shader.tsx`  

Why these first:
- They are all **frontend runtime** files (not scripts/server).
- They sit near the app entry path, so converting them gives fast consistency wins.
- They’re relatively isolated compared with bond/stats data hooks, so lower migration risk early.

After these 5, next best batch is JS hooks in `hooks/` that are imported by TS components.

Hooks first.

Reason (based on your current repo state):
- `components/` is already fully TSX (all 5 files are `.tsx`).
- `hooks/` is still mixed, with 5 remaining `.js` hooks.
- Your components depend on hooks heavily, so typing hooks first gives better type safety upstream and keeps components “display-focused” as you prefer.

So the practical order is:
1. Finish remaining JS hooks in `hooks/`
2. Then move to `utils/*.js` used by those hooks
3. Then `constants/*.js` used by runtime app code

For your repo, the immediate next hooks are:
- `hooks/useCommittedPrana.js`
- `hooks/useCommittedWbtc.js`
- `hooks/useBuyBondBalanceData.js`
- `hooks/useSellBondBalanceData.js`
- `hooks/useTotalBondPranaVolume.js`

So yes — for `@JS to TS.md:3-5`, choose **hooks before components**.