<script lang="tsx">
import { defineComponent, ref } from "vue";

export default defineComponent({
  setup() {
    const count = ref(0);
    const render = () => <div>{count.value}</div>;
    return render;
  },
});
</script>
