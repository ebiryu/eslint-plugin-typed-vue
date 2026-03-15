import { greet } from "./helper";

export function run() {
  let message = greet("world");
  let count = 42;
  return { message, count };
}
