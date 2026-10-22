(function(fetch){
/* Lynx Right Click Images 2.0.0 */
(() => {
  "use strict";
  if (window.__lynxRightClickImagesInstalled) return;
  window.__lynxRightClickImagesInstalled = true;
  const UI = window.LynxRightClickUI;

  async function imageDetails(imageId) {
    const data = await UI.gql(`query LynxImageDetails($id: ID!) {
      findImage(id: $id) {
        id title paths { image }
        tags { id }
        performers { id name disambiguation gender image_path }
        galleries {
          id title
          performers { id name disambiguation gender image_path }
          scenes { id }
        }
      }
    }`, { id: imageId });
    return data.findImage;
  }

  function updateLinks(imageId, title, type) {
    const field = type === "Tags" ? "tags" : "performers";
    const inputField = type === "Tags" ? "tag_ids" : "performer_ids";
    UI.openPicker({
      entity: type,
      title: `Add ${field}`,
      subtitle: title,
      existingIds: async () => new Set((await imageDetails(imageId))?.[field]?.map((item) => String(item.id)) || []),
      onSave: async (selectedIds, _items, existing) => {
        const input = { id: imageId, [inputField]: [...new Set([...existing, ...selectedIds])] };
        await UI.gql(`mutation LynxImageUpdate($input: ImageUpdateInput!) {
          imageUpdate(input: $input) { id }
        }`, { input });
        UI.toast(`Added ${selectedIds.length} ${selectedIds.length === 1 ? field.slice(0, -1) : field} to the image.`);
      },
      errorMessage: `Could not add ${field} to the image.`,
    });
  }

  async function openSceneLinker(imageId, title) {
    let details;
    try { details = await imageDetails(imageId); }
    catch (error) { console.error(error); UI.toast("Could not read the image.", "error"); return; }
    const linkedSceneIds = new Set((details?.galleries || []).flatMap((gallery) => gallery.scenes || []).map((scene) => String(scene.id)));
    UI.openPicker({
      entity: "Scenes",
      title: "Link scenes through galleries",
      subtitle: title,
      existingIds: linkedSceneIds,
      saveLabel: "Create and link",
      onSave: async (sceneIds, sceneItems) => {
        let imageGalleryIds = (details?.galleries || []).map((gallery) => String(gallery.id));
        for (const sceneId of sceneIds) {
          const scene = sceneItems.find((item) => String(item.id) === String(sceneId));
          const sceneData = await UI.gql(`query LynxSceneGalleries($id: ID!) {
            findScene(id: $id) { title galleries { id } }
          }`, { id: sceneId });
          const sceneTitle = scene?.title || sceneData.findScene?.title || `Scene ${sceneId}`;
          const created = await UI.gql(`mutation LynxGalleryCreate($input: GalleryCreateInput!) {
            galleryCreate(input: $input) { id }
          }`, { input: { title: sceneTitle } });
          const galleryId = String(created.galleryCreate.id);
          imageGalleryIds = [...new Set([...imageGalleryIds, galleryId])];
          const sceneGalleryIds = [...new Set([...(sceneData.findScene?.galleries || []).map((gallery) => String(gallery.id)), galleryId])];
          await UI.gql(`mutation LynxLinkImage($input: ImageUpdateInput!) { imageUpdate(input: $input) { id } }`, {
            input: { id: imageId, gallery_ids: imageGalleryIds },
          });
          await UI.gql(`mutation LynxLinkScene($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`, {
            input: { id: sceneId, gallery_ids: sceneGalleryIds },
          });
        }
        UI.toast(`Linked the image to ${sceneIds.length} ${sceneIds.length === 1 ? "scene" : "scenes"}.`);
      },
      errorMessage: "Could not link the image to the selected scenes.",
    });
  }

  async function choosePerformerImageTarget(imageId, title) {
    try {
      const details = await imageDetails(imageId);
      const direct = details?.performers || [];
      const inherited = (details?.galleries || []).flatMap((gallery) => gallery.performers || []);
      const performers = [...new Map([...direct, ...inherited].map((item) => [String(item.id), item])).values()];
      if (!performers.length) { UI.toast("No performer is linked to this image or its galleries.", "error"); return; }
      UI.openPicker({
        entity: "Performers",
        title: "Use image as performer portrait",
        subtitle: title,
        staticItems: performers,
        single: true,
        saveLabel: "Update portrait",
        onSave: async (ids, items) => {
          const performer = items[0];
          await UI.gql(`mutation LynxPerformerPortrait($input: PerformerUpdateInput!) {
            performerUpdate(input: $input) { id }
          }`, { input: { id: ids[0], image: details.paths.image } });
          UI.toast(`Updated the portrait for ${performer.name}.`);
        },
        errorMessage: "Could not update the performer portrait.",
      });
    } catch (error) { console.error(error); UI.toast("Could not prepare the performer list.", "error"); }
  }

  async function chooseGalleryCover(imageId, title) {
    try {
      const details = await imageDetails(imageId);
      const galleries = details?.galleries || [];
      if (!galleries.length) { UI.toast("This image is not linked to a gallery.", "error"); return; }
      UI.openPicker({
        entity: "Galleries",
        title: "Set gallery cover",
        subtitle: title,
        staticItems: galleries,
        single: true,
        saveLabel: "Set cover",
        onSave: async (ids, items) => {
          await UI.gql(`mutation LynxSetGalleryCover($galleryId: ID!, $imageId: ID!) {
            setGalleryCover(input: { gallery_id: $galleryId, cover_image_id: $imageId })
          }`, { galleryId: ids[0], imageId });
          UI.toast(`Updated the cover for ${items[0].title || "the gallery"}.`);
        },
        errorMessage: "Could not set the gallery cover.",
      });
    } catch (error) { console.error(error); UI.toast("Could not read linked galleries.", "error"); }
  }

  function cardInfo(card) {
    const link = Array.from(card.querySelectorAll("a")).find((node) => /\/images\/\d+/.test(node.getAttribute("href") || ""));
    const id = link?.getAttribute("href")?.match(/\/images\/(\d+)/)?.[1];
    const title = card.querySelector(".card-section-title, h5")?.textContent?.trim() || link?.getAttribute("title") || `Image ${id}`;
    return { id, title };
  }

  document.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".image-card");
    if (!card) return;
    const image = cardInfo(card);
    if (!image.id) return;
    event.preventDefault(); event.stopPropagation();
    UI.showMenu({
      x: event.clientX, y: event.clientY, heading: "Image actions",
      actions: [
        { label: "View image", icon: "↗", onClick: () => { location.href = `/images/${image.id}`; } },
        { divider: true },
        { label: "Add tags", icon: "◆", onClick: () => updateLinks(image.id, image.title, "Tags") },
        { label: "Add performers", icon: "●", onClick: () => updateLinks(image.id, image.title, "Performers") },
        { label: "Link scenes", icon: "▶", onClick: () => openSceneLinker(image.id, image.title) },
        { divider: true },
        { label: "Use as performer portrait", icon: "◉", onClick: () => choosePerformerImageTarget(image.id, image.title) },
        { label: "Set gallery cover", icon: "▣", onClick: () => chooseGalleryCover(image.id, image.title) },
      ],
    });
  });
})();


})(window.LynxToolsRuntime.fetchFor("stashRightClickImages"));
