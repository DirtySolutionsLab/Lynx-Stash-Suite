(function(fetch){
/* Lynx Right Click Tags 2.0.0 */
(() => {
  "use strict";
  if (window.__lynxRightClickTagsInstalled) return;
  window.__lynxRightClickTagsInstalled = true;
  const UI = window.LynxRightClickUI;

  function tagInfo(card) {
    const link = Array.from(card.querySelectorAll("a")).find((node) => /\/tags\/\d+/.test(node.getAttribute("href") || ""));
    const id = link?.getAttribute("href")?.match(/\/tags\/(\d+)/)?.[1];
    const name = card.querySelector("h5")?.textContent?.trim() || link?.textContent?.trim() || `Tag ${id}`;
    return { id, name };
  }

  function confirmAutoTag(tag) {
    UI.confirm({
      title: "Auto-tag with this tag?",
      subtitle: tag.name,
      icon: "◆",
      message: "Stash will scan your library and apply this tag where its auto-tag rules match.",
      confirmLabel: "Start auto-tagging",
      onConfirm: async () => {
        const data = await UI.gql(`mutation LynxTagAutoTag($tagIds: [String!]) {
          metadataAutoTag(input: { tags: $tagIds })
        }`, { tagIds: [tag.id] });
        if (!data.metadataAutoTag) throw new Error("Auto-tagging did not start");
        UI.toast(`Auto-tagging started for ${tag.name}.`);
      },
    });
  }

  async function prepareDelete(tag) {
    try {
      const data = await UI.gql(`query LynxTagMarkers($tagIds: [ID!]!) {
        findSceneMarkers(
          scene_marker_filter: { tags: { value: $tagIds, modifier: EQUALS } }
          filter: { per_page: -1 }
        ) {
          scene_markers { id primary_tag { id } }
        }
      }`, { tagIds: [tag.id] });
      const primaryMarkers = (data.findSceneMarkers?.scene_markers || []).filter((marker) => String(marker.primary_tag?.id) === String(tag.id));
      UI.confirm({
        title: "Delete tag permanently?",
        subtitle: tag.name,
        icon: "!",
        message: `This will permanently delete “${tag.name}”.`,
        detail: primaryMarkers.length
          ? `${primaryMarkers.length} scene marker${primaryMarkers.length === 1 ? "" : "s"} using this as their primary tag will also be deleted.`
          : "No scene markers use this as their primary tag.",
        confirmLabel: "Delete tag",
        danger: true,
        onConfirm: async () => {
          for (const marker of primaryMarkers) {
            await UI.gql(`mutation LynxMarkerDestroy($id: ID!) { sceneMarkerDestroy(id: $id) }`, { id: marker.id });
          }
          await UI.gql(`mutation LynxTagDestroy($input: TagDestroyInput!) { tagDestroy(input: $input) }`, { input: { id: tag.id } });
          UI.toast(`Deleted ${tag.name}.`);
        },
      });
    } catch (error) {
      console.error(error);
      UI.toast("Could not inspect the tag before deletion.", "error");
    }
  }

  document.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".tag-card");
    if (!card) return;
    const tag = tagInfo(card);
    if (!tag.id) return;
    event.preventDefault();
    event.stopPropagation();
    UI.showMenu({
      x: event.clientX,
      y: event.clientY,
      heading: "Tag actions",
      actions: [
        { label: "View tag", icon: "↗", onClick: () => { location.href = `/tags/${tag.id}`; } },
        { divider: true },
        { label: "Auto-tag", icon: "⌁", onClick: () => confirmAutoTag(tag) },
        { divider: true },
        { label: "Delete tag", icon: "×", danger: true, onClick: () => prepareDelete(tag) },
      ],
    });
  });
})();

})(window.LynxToolsRuntime.fetchFor("stashRightClickTags"));
