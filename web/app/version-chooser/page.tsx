import { cookies } from "next/headers";
import { PageFrame, PageHeading, VersionChooser } from "@/components/v2";
import { UI_VERSION_COOKIE, type UiVersion } from "@/lib/v2/routes";

export const dynamic = "force-dynamic";

export default async function VersionChooserPage() {
  const stored = (await cookies()).get(UI_VERSION_COOKIE)?.value;
  const preferred: UiVersion | undefined = stored === "v1" || stored === "v2" ? stored : undefined;

  return (
    <div className="v2-version-chooser" data-v2>
      <PageFrame width="reading">
        <PageHeading
          description="Choose the interface you want to use. Both versions share the same account, permissions, data, and fabrication engine."
          eyebrow="FabricatorOS"
          title="Choose your workspace"
        />
        <VersionChooser preferred={preferred} />
      </PageFrame>
    </div>
  );
}
