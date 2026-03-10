<script lang="tsx">
import { defineComponent } from "vue";

export default defineComponent({
  setup() {
    // This should trigger @typescript-eslint/no-unsafe-assignment
    const x: string = {} as any;
    const render = () => <div>{x}</div>;
    return render;
  },
});
</script>
