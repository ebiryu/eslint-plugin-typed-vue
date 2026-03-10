import SafeDual from "./safe-dual.vue";
import type { Item } from "./safe-dual.vue";

// Both the component and the exported type should be properly typed
const comp = SafeDual;
const item: Item = { id: 1, name: "test" };

export { comp, item };
