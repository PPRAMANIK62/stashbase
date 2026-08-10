/**
 * PROTOTYPE — interactive shell for the folder-switch Chat lifecycle model.
 * Run with: pnpm prototype:folder-chat-tabs
 */
import {
  initialPrototypeState,
  reducePrototype,
  scopeLabel,
  type ChatScope,
  type PrototypeAction,
} from './model.ts';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

let state = initialPrototypeState();

function render(): void {
  console.clear();
  console.log(`${bold}Folder-switch Chat lifecycle — THROWAWAY PROTOTYPE${reset}`);
  console.log(`${dim}Question: preserve real work while always presenting a welcome Tab in a newly visited scope.${reset}\n`);
  console.log(`${bold}Location:${reset} ${scopeLabel(state.location)}`);
  console.log(`${bold}Active Tab:${reset} ${state.activeTabId}`);
  console.log(`${bold}Last action:${reset} ${state.lastAction}\n`);
  console.log(`${bold}Tabs${reset}`);
  for (const tab of state.tabs) {
    const marker = tab.id === state.activeTabId ? '→' : ' ';
    console.log(`${marker} Tab ${tab.id}  scope=${scopeLabel(tab.scope).padEnd(10)} state=${tab.state}`);
  }
  console.log(`\n${bold}Actions${reset}`);
  console.log(`${bold}l${reset} ${dim}Library${reset}  ${bold}1${reset} ${dim}Alpha${reset}  ${bold}2${reset} ${dim}Beta${reset}  ${bold}3${reset} ${dim}Gamma${reset}`);
  console.log(`${bold}d${reset} ${dim}type unsent draft${reset}  ${bold}c${reset} ${dim}clear draft${reset}  ${bold}s${reset} ${dim}send first message${reset}`);
  console.log(`${bold}n${reset} ${dim}New Chat${reset}  ${bold}t${reset} ${dim}next Tab${reset}  ${bold}x${reset} ${dim}close active${reset}  ${bold}q${reset} ${dim}quit${reset}`);
}

function navigationScope(key: string): ChatScope | null {
  if (key === 'l') return { kind: 'library' };
  if (key === '1') return { kind: 'folder', name: 'Alpha' };
  if (key === '2') return { kind: 'folder', name: 'Beta' };
  if (key === '3') return { kind: 'folder', name: 'Gamma' };
  return null;
}

function actionFor(key: string): PrototypeAction | null {
  const scope = navigationScope(key);
  if (scope) return { type: 'navigate', scope };
  if (key === 'd') return { type: 'draft' };
  if (key === 'c') return { type: 'clear-draft' };
  if (key === 's') return { type: 'start' };
  if (key === 'n') return { type: 'new-chat' };
  if (key === 't') return { type: 'activate-next' };
  if (key === 'x') return { type: 'close-active' };
  return null;
}

if (!process.stdin.isTTY) {
  throw new Error('Run this prototype in an interactive terminal.');
}

process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();
process.stdin.on('data', (input: string) => {
  for (const rawKey of input) {
    const key = rawKey.toLowerCase();
    if (key === 'q' || key === '\u0003') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.clear();
      process.exit(0);
    }
    const action = actionFor(key);
    if (action) state = reducePrototype(state, action);
  }
  render();
});

render();
