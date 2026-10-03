// Drag & drop helpers. Items and folders both use custom MIME types so a drop
// target can tell what is being dragged.
export const ITEM_MIME = 'application/x-vault-item';
export const FOLDER_MIME = 'application/x-vault-folder';

export function itemDragProps(item) {
  return {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData(ITEM_MIME, item.id);
      e.dataTransfer.effectAllowed = 'move';
    }
  };
}
