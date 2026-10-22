(function(fetch){
/* Lynx Right Click Galleries 2.0.0 */
(() => {
  "use strict";
  if (window.__lynxRightClickGalleriesInstalled) return;
  window.__lynxRightClickGalleriesInstalled = true;
  const UI = window.LynxRightClickUI;

  const entityMap = {
    Tags: { field: "tags", input: "tag_ids" },
    Performers: { field: "performers", input: "performer_ids" },
    Scenes: { field: "scenes", input: "scene_ids" },
  };

  async function currentIds(galleryId, field) {
    const data = await UI.gql(`query LynxGalleryLinks($id: ID!) {
      findGallery(id: $id) { tags { id } performers { id } scenes { id } }
    }`, { id: galleryId });
    return new Set((data.findGallery?.[field] || []).map((item) => String(item.id)));
  }

  function openAdd(type, galleryId, galleryTitle) {
    const mapping = entityMap[type];
    UI.openPicker({
      entity: type,
      title: `Add ${mapping.field}`,
      subtitle: galleryTitle,
      existingIds: () => currentIds(galleryId, mapping.field),
      onSave: async (selectedIds, _items, existing) => {
        const input = { id: galleryId, [mapping.input]: [...new Set([...existing, ...selectedIds])] };
        await UI.gql(`mutation LynxGalleryUpdate($input: GalleryUpdateInput!) {
          galleryUpdate(input: $input) { id }
        }`, { input });
        UI.toast(`Added ${selectedIds.length} ${selectedIds.length === 1 ? mapping.field.slice(0, -1) : mapping.field} to the gallery.`);
      },
      errorMessage: `Could not add ${mapping.field} to the gallery.`,
    });
  }

  function galleryInfo(card) {
    const link = Array.from(card.querySelectorAll("a")).find((node) => /\/galleries\/\d+/.test(node.getAttribute("href") || ""));
    const id = link?.getAttribute("href")?.match(/\/galleries\/(\d+)/)?.[1];
    const title = card.querySelector("h5")?.textContent?.trim() || link?.textContent?.trim() || `Gallery ${id}`;
    return { id, title };
  }

  document.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".gallery-card");
    if (!card) return;
    const gallery = galleryInfo(card);
    if (!gallery.id) return;
    event.preventDefault();
    event.stopPropagation();
    UI.showMenu({
      x: event.clientX,
      y: event.clientY,
      heading: "Gallery actions",
      actions: [
        { label: "View gallery", icon: "↗", onClick: () => { location.href = `/galleries/${gallery.id}`; } },
        { divider: true },
        { label: "Add tags", icon: "◆", onClick: () => openAdd("Tags", gallery.id, gallery.title) },
        { label: "Add performers", icon: "●", onClick: () => openAdd("Performers", gallery.id, gallery.title) },
        { label: "Add scenes", icon: "▶", onClick: () => openAdd("Scenes", gallery.id, gallery.title) },
      ],
    });
  });
})();


})(window.LynxToolsRuntime.fetchFor("stashRightClickGalleries"));
