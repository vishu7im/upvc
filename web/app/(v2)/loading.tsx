import { LoadingState, PageFrame } from "@/components/v2";

export default function V2Loading() {
  return (
    <div data-v2>
      <PageFrame width="detail">
        <LoadingState label="Loading workspace" rows={5} />
      </PageFrame>
    </div>
  );
}
