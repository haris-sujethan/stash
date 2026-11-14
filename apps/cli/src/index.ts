#!/usr/bin/env node
import { buildProgram } from "./program.js";
import { UserError } from "./config.js";

try {
  await buildProgram().parseAsync(process.argv);
} catch (err) {
  if (err instanceof UserError) {
    console.error(err.message);
    process.exitCode = 1;
  } else {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
  }
}
