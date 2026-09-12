/**
 * dsh-web-access host half — registers the `/web` slash command.
 *
 * The command is an entry point, not a browser driver: its handler turns the
 * typed instruction into one ordinary user message and steers it to the model
 * (the same pattern `/plan [message]` uses). The model's next step loads the
 * web-access skill from the skills catalog and drives a real Chrome/Edge
 * through CDP via the skill's cdp.mjs (Node native WebSocket, zero deps).
 *
 * The command itself submits nothing to the model and adds no tokens; the
 * steered user message is billed exactly like any other user input.
 *
 * @module @captain1275/dsh-web-access
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export declare const name = "web-access";
/** The command registry must be composed before this plugin activates. */
export declare const inject: string[];
/** Register the `/web` slash command for every composed command adapter. */
export declare function apply(ctx: Context): void;
