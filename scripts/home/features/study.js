(() => {
const {
  byId,
} = window.homeDom;
const {
  setWindowOpen,
} = window.homeWindows;
const {
  notifyActivity,
} = window.homeActivity;

const studyTree = byId("study-tree");
const studyFilePane = byId("study-file-pane");
const studyAddress = byId("study-address");
const studyCurrentTitle = byId("study-current-title");
const studyItemCount = byId("study-item-count");
const studyPreviewIcon = byId("study-preview-icon");
const studyPreviewTitle = byId("study-preview-title");
const studyPreviewBody = byId("study-preview-body");
const studyOpenWindow = byId("study-open-window");
const studyOpenTab = byId("study-open-tab");
const studyDownload = byId("study-download");
const studyUp = byId("study-up");
const studyListView = byId("study-list-view");
const studyGalleryView = byId("study-gallery-view");
const studyStatusLeft = byId("study-status-left");
const studyStatusRight = byId("study-status-right");
const studyPdfTitle = byId("study-pdf-title");
const studyPdfIframe = byId("study-pdf-iframe");

const STUDY_ICONS = {
  folderClosed: "assets/app-icons/ico/directory_closed.ico",
  folderOpen: "assets/app-icons/ico/directory_open.ico",
  document: "assets/app-icons/ico/document.ico",
};

const STUDY_MANIFEST_URL = "assets/study%20resources/manifest.json";

const studyResourcesRoot = {
  id: "study-resources",
  type: "folder",
  name: "Study Resources",
  // Future PDFs should live under assets/study resources/{school}/{type}/{course}/{resource}.pdf.
  children: [
    {
      id: "uc-berkeley",
      type: "folder",
      name: "UC Berkeley",
      children: [
    {
      id: "bioeng",
      type: "folder",
      name: "BIOENG",
      children: [
        { id: "bioeng-101", type: "folder", name: "BIOENG 101", children: [] },
        { id: "bioeng-145", type: "folder", name: "BIOENG 145", children: [] },
        { id: "bioeng-190", type: "folder", name: "BIOENG 190", children: [] },
        { id: "bioeng-103", type: "folder", name: "BIOENG 103", children: [] },
        { id: "bioeng-147", type: "folder", name: "BIOENG 147", children: [] },
        { id: "bioeng-104", type: "folder", name: "BIOENG 104", children: [] },
        { id: "bioeng-135", type: "folder", name: "BIOENG 135", children: [] },
        { id: "bioeng-114", type: "folder", name: "BIOENG 114", children: [] },
        { id: "bioeng-c149", type: "folder", name: "BIOENG C149", children: [] },
        { id: "bioeng-11", type: "folder", name: "BIOENG 11", children: [] },
        { id: "bioeng-100", type: "folder", name: "BIOENG 100", children: [] },
        { id: "bioeng-26", type: "folder", name: "BIOENG 26", children: [] },
        { id: "bioeng-25", type: "folder", name: "BIOENG 25", children: [] },
        { id: "bioeng-171", type: "folder", name: "BIOENG 171", children: [] },
        { id: "bioeng-10", type: "folder", name: "BIOENG 10", children: [] },
      ],
    },
    {
      id: "compsci",
      type: "folder",
      name: "COMPSCI",
      children: [
        { id: "compsci-189", type: "folder", name: "COMPSCI 189", children: [] },
        { id: "compsci-161", type: "folder", name: "COMPSCI 161", children: [] },
        { id: "compsci-188", type: "folder", name: "COMPSCI 188", children: [] },
        { id: "compsci-61c", type: "folder", name: "COMPSCI 61C", children: [] },
        { id: "compsci-70", type: "folder", name: "COMPSCI 70", children: [] },
        { id: "compsci-61b", type: "folder", name: "COMPSCI 61B", children: [] },
        { id: "compsci-61a", type: "folder", name: "COMPSCI 61A", children: [] },
      ],
    },
    {
      id: "engin",
      type: "folder",
      name: "ENGIN",
      children: [
        { id: "engin-198", type: "folder", name: "ENGIN 198", children: [] },
        { id: "engin-183a", type: "folder", name: "ENGIN 183A", children: [] },
        { id: "engin-183e", type: "folder", name: "ENGIN 183E", children: [] },
      ],
    },
    {
      id: "eecs",
      type: "folder",
      name: "EECS",
      children: [
        { id: "eecs-c106a", type: "folder", name: "EECS C106A", children: [] },
        { id: "eecs-16b", type: "folder", name: "EECS 16B", children: [] },
        { id: "eecs-16a", type: "folder", name: "EECS 16A", children: [] },
      ],
    },
    {
      id: "chem",
      type: "folder",
      name: "CHEM",
      children: [
        { id: "chem-3a", type: "folder", name: "CHEM 3A", children: [] },
        { id: "chem-3al", type: "folder", name: "CHEM 3AL", children: [] },
      ],
    },
    {
      id: "math",
      type: "folder",
      name: "MATH",
      children: [
        { id: "math-54", type: "folder", name: "MATH 54", children: [] },
        { id: "math-w53", type: "folder", name: "MATH W53", children: [] },
      ],
    },
    {
      id: "etc-tech",
      type: "folder",
      name: "ETC. (tech)",
      children: [
        {
          id: "eleng",
          type: "folder",
          name: "ELENG",
          children: [
            { id: "eleng-122", type: "folder", name: "ELENG 122", children: [] },
          ],
        },
        {
          id: "physics",
          type: "folder",
          name: "PHYSICS",
          children: [
            { id: "physics-7b", type: "folder", name: "PHYSICS 7B", children: [] },
          ],
        },
        {
          id: "cmpbio",
          type: "folder",
          name: "CMPBIO",
          children: [
            { id: "cmpbio-198bc", type: "folder", name: "CMPBIO 198BC", children: [] },
          ],
        },
        {
          id: "stat",
          type: "folder",
          name: "STAT",
          children: [
            { id: "stat-20", type: "folder", name: "STAT 20", children: [] },
          ],
        },
      ],
    },
    {
      id: "etc-non-tech",
      type: "folder",
      name: "ETC. (non-tech)",
      children: [
        {
          id: "english",
          type: "folder",
          name: "ENGLISH",
          children: [
            { id: "english-198", type: "folder", name: "ENGLISH 198", children: [] },
          ],
        },
        {
          id: "econ",
          type: "folder",
          name: "ECON",
          children: [
            { id: "econ-1", type: "folder", name: "ECON 1", children: [] },
          ],
        },
        {
          id: "theater",
          type: "folder",
          name: "THEATER",
          children: [
            { id: "theater-r1b", type: "folder", name: "THEATER R1B", children: [] },
          ],
        },
        {
          id: "desinv",
          type: "folder",
          name: "DESINV",
          children: [
            { id: "desinv-21", type: "folder", name: "DESINV 21", children: [] },
          ],
        },
        {
          id: "history",
          type: "folder",
          name: "HISTORY",
          children: [
            { id: "history-136b", type: "folder", name: "HISTORY 136B", children: [] },
          ],
        },
        {
          id: "polsci",
          type: "folder",
          name: "POLSCI",
          children: [
            { id: "polsci-5", type: "folder", name: "POLSCI 5", children: [] },
          ],
        },
        {
          id: "ugba",
          type: "folder",
          name: "UGBA",
          children: [
            { id: "ugba-10", type: "folder", name: "UGBA 10", children: [] },
          ],
        },
      ],
    },
  ],
},
{
  id: "yale",
  type: "folder",
  name: "Yale",
  children: [],
},
    ],
  };

const studyState = {
  selectedId: "study-resources",
  expandedIds: new Set(["study-resources"]),
  viewMode: "list",
};

const studyIndex = new Map();

const studyBuildIndex = (node, parentId = null, path = []) => {
  const nextPath = [...path, node.name];
  studyIndex.set(node.id, { node, parentId, path: nextPath });
  (node.children || []).forEach((child) => {
    studyBuildIndex(child, node.id, nextPath);
  });
};

const studyRebuildIndex = () => {
  studyIndex.clear();
  studyBuildIndex(studyResourcesRoot);
};

const studyGetEntry = (id) => studyIndex.get(id) || null;

const studyGetSelectedEntry = () => studyGetEntry(studyState.selectedId);

const studyGetParentEntry = (entry) =>
  entry && entry.parentId ? studyGetEntry(entry.parentId) : null;

const studyIsFolder = (node) => node && node.type === "folder";

const studyIsPdf = (node) => node && node.type === "pdf";

const studyPathText = (entry) => (entry ? entry.path.join("\\") : "Study Resources");

const studyObjectCountText = (count) => `${count} object${count === 1 ? "" : "s"}`;

const studySubitemCount = (node) =>
  studyIsFolder(node) && Array.isArray(node.children) ? node.children.length : 0;

const studySubitemText = (node) =>
  `${studySubitemCount(node)} item${studySubitemCount(node) === 1 ? "" : "s"}`;

const studyStorageBytes = (node) => {
  if (!node) return 0;
  if (studyIsPdf(node)) return Number(node.sizeBytes) || 0;
  return (node.children || []).reduce(
    (total, child) => total + studyStorageBytes(child),
    0
  );
};

const studyFormatStorage = (bytes) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
};

const studyStorageText = (node) => studyFormatStorage(studyStorageBytes(node));

const studyMetadataText = (node) => `${studySubitemText(node)}, ${studyStorageText(node)}`;

const studyTypeText = (node) => (studyIsPdf(node) ? "PDF Document" : "File Folder");

const studyIconForNode = (node) => {
  if (studyIsPdf(node)) return STUDY_ICONS.document;
  return studyState.expandedIds.has(node.id)
    ? STUDY_ICONS.folderOpen
    : STUDY_ICONS.folderClosed;
};

const studyPdfEmbedSrc = (node, page = 1, zoom = 100) =>
  node && node.path
    ? `${node.path}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0`
    : "";

const studyPdfThumbnailPages = (node) =>
  Array.isArray(node.thumbnailPages) && node.thumbnailPages.length
    ? node.thumbnailPages
    : [1, 2, 3];

const studySlug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const studyChildIdExists = (root, id) => {
  if (root.id === id) return true;
  return (root.children || []).some((child) => studyChildIdExists(child, id));
};

const studyUniqueId = (baseId) => {
  let id = baseId;
  let index = 2;
  while (studyChildIdExists(studyResourcesRoot, id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  return id;
};

const studyEnsureFolderPath = (folderPath) => {
  let current = studyResourcesRoot;
  const pathParts = [];

  folderPath.forEach((folderName) => {
    pathParts.push(folderName);
    current.children = current.children || [];
    let next = current.children.find(
      (child) => studyIsFolder(child) && child.name === folderName
    );

    if (!next) {
      next = {
        id: studyUniqueId(`folder-${pathParts.map(studySlug).join("-")}`),
        type: "folder",
        name: folderName,
        children: [],
      };
      current.children.push(next);
    }

    current = next;
  });

  return current;
};

const studyMergeManifest = (manifest) => {
  const files = Array.isArray(manifest && manifest.files) ? manifest.files : [];

  files.forEach((file) => {
    if (!file || !file.path || !file.name) return;
    const folderPath = Array.isArray(file.folderPath) ? file.folderPath : [];
    const folder = studyEnsureFolderPath(folderPath);
    folder.children = folder.children || [];

    const existing = folder.children.find(
      (child) => studyIsPdf(child) && child.path === file.path
    );
    if (existing) {
      existing.name = file.name;
      existing.sizeBytes = Number(file.sizeBytes) || 0;
      existing.thumbnailPages = file.thumbnailPages;
      return;
    }

    folder.children.push({
      id: studyUniqueId(
        `pdf-${[...folderPath, file.name].map(studySlug).join("-")}`
      ),
      type: "pdf",
      name: file.name,
      path: file.path,
      sizeBytes: Number(file.sizeBytes) || 0,
      thumbnailPages: file.thumbnailPages,
      downloadName: file.downloadName || file.name,
    });
  });
};

const studyLoadManifest = async () => {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch(STUDY_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    studyMergeManifest(manifest);
    studyRebuildIndex();
    studyRender();
  } catch (error) {
    // Static file browsing may block fetch(); the scaffold still works without a manifest.
  }
};

const studyCreateIcon = (src) => {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  return image;
};

const studyCreateEmpty = (text, className = "study-empty") => {
  const empty = document.createElement("div");
  empty.className = className;
  empty.textContent = text;
  return empty;
};

const studyCreateText = (className, text) => {
  const element = document.createElement("span");
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

const studyRenderFileListHeader = () => {
  const header = document.createElement("div");
  header.className = "study-file-list-header";
  header.setAttribute("aria-hidden", "true");
  ["", "Name", "Type", "Items", "Size"].forEach((label) => {
    header.appendChild(studyCreateText("", label));
  });
  return header;
};

const studySetSelected = (id) => {
  if (!studyGetEntry(id)) return;
  studyState.selectedId = id;
  studyRender();
};

const studyToggleFolder = (id, forceOpen = null) => {
  const entry = studyGetEntry(id);
  if (!entry || !studyIsFolder(entry.node)) return;
  const shouldOpen =
    forceOpen === null ? !studyState.expandedIds.has(id) : Boolean(forceOpen);
  if (shouldOpen) {
    studyState.expandedIds.add(id);
  } else {
    studyState.expandedIds.delete(id);
  }
  studyRender();
};

const studySelectedPdfEntry = () => {
  const entry = studyGetSelectedEntry();
  return entry && studyIsPdf(entry.node) ? entry : null;
};

const studyOpenSelectedInWindow = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path || !studyPdfIframe || !studyPdfTitle) return;
  studyPdfTitle.textContent = entry.node.name;
  studyPdfIframe.title = entry.node.name;
  studyPdfIframe.dataset.src = studyPdfEmbedSrc(entry.node);
  studyPdfIframe.removeAttribute("src");
  setWindowOpen("study-pdf", true);
};

const studyOpenSelectedInTab = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path) return;
  notifyActivity("newTabLink", { href: entry.node.path, source: "study-resources" });
  window.open(entry.node.path, "_blank", "noopener,noreferrer");
};

const studyDownloadSelected = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path) return;
  const link = document.createElement("a");
  link.href = entry.node.path;
  link.download = entry.node.downloadName || entry.node.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  notifyActivity("fileDownload", {
    href: entry.node.path,
    source: "study-resources",
  });
};

const studyRenderTreeNode = (entry) => {
  const { node } = entry;
  const item = document.createElement("li");
  const row = document.createElement("div");
  row.className = "study-tree-row";

  if (studyIsFolder(node)) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "study-tree-toggle";
    toggle.dataset.studyToggle = node.id;
    toggle.setAttribute(
      "aria-label",
      `${studyState.expandedIds.has(node.id) ? "Close" : "Open"} ${node.name}`
    );
    toggle.textContent = studyState.expandedIds.has(node.id) ? "-" : "+";
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "study-tree-toggle-spacer";
    row.appendChild(spacer);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "study-tree-item";
  button.dataset.studySelect = node.id;
  button.setAttribute(
    "aria-label",
    `${node.name}, ${studyTypeText(node)}, ${studyMetadataText(node)}`
  );
  if (studyState.selectedId === node.id) button.classList.add("is-selected");
  button.appendChild(studyCreateIcon(studyIconForNode(node)));

  button.appendChild(studyCreateText("", node.name));
  button.appendChild(studyCreateText("study-tree-meta", `(${studyMetadataText(node)})`));
  row.appendChild(button);
  item.appendChild(row);

  if (studyIsFolder(node) && studyState.expandedIds.has(node.id)) {
    const children = node.children || [];
    if (children.length) {
      const childList = document.createElement("ul");
      children.forEach((child) => {
        const childEntry = studyGetEntry(child.id);
        if (childEntry) childList.appendChild(studyRenderTreeNode(childEntry));
      });
      item.appendChild(childList);
    }
  }

  return item;
};

const studyRenderTree = () => {
  if (!studyTree) return;
  const rootEntry = studyGetEntry(studyResourcesRoot.id);
  if (!rootEntry) return;
  const list = document.createElement("ul");
  list.className = "study-tree-list";
  list.appendChild(studyRenderTreeNode(rootEntry));
  studyTree.replaceChildren(list);
};

const studyRenderFilePane = () => {
  if (!studyFilePane) return;
  const selected = studyGetSelectedEntry();
  const browseEntry =
    selected && studyIsFolder(selected.node)
      ? selected
      : studyGetParentEntry(selected) || studyGetEntry(studyResourcesRoot.id);
  const children = browseEntry && browseEntry.node.children ? browseEntry.node.children : [];

  studyFilePane.classList.toggle("is-list", studyState.viewMode === "list");
  studyFilePane.classList.toggle("is-gallery", studyState.viewMode === "gallery");

  if (studyCurrentTitle) studyCurrentTitle.textContent = browseEntry.node.name;
  if (studyItemCount) {
    studyItemCount.textContent = `${studyObjectCountText(children.length)}, ${studyStorageText(browseEntry.node)}`;
  }

  if (!children.length) {
    studyFilePane.replaceChildren(
      studyCreateEmpty(
        "This folder is empty. Course folders and PDFs will appear here after the class list is added."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  if (studyState.viewMode === "list") {
    fragment.appendChild(studyRenderFileListHeader());
  }

  children.forEach((child) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-file-item";
    button.dataset.studyFile = child.id;
    button.setAttribute(
      "aria-label",
      `${child.name}, ${studyTypeText(child)}, ${studyMetadataText(child)}`
    );
    if (studyState.selectedId === child.id) button.classList.add("is-selected");
    button.appendChild(studyCreateIcon(studyIconForNode(child)));

    button.appendChild(studyCreateText("study-file-name", child.name));
    button.appendChild(studyCreateText("study-file-type", studyTypeText(child)));
    button.appendChild(studyCreateText("study-file-subitems", studySubitemText(child)));
    button.appendChild(studyCreateText("study-file-storage", studyStorageText(child)));

    fragment.appendChild(button);
  });

  studyFilePane.replaceChildren(fragment);
};

const studyRenderPdfPreview = (node) => {
  const wrapper = document.createElement("div");
  wrapper.className = "study-preview-pdf";

  const thumbnails = document.createElement("div");
  thumbnails.className = "study-pdf-thumbnails";
  thumbnails.setAttribute("aria-label", `${node.name} page thumbnails`);

  const main = document.createElement("div");
  main.className = "study-pdf-main";

  const mainIframe = document.createElement("iframe");
  mainIframe.src = studyPdfEmbedSrc(node);
  mainIframe.title = node.name;
  main.appendChild(mainIframe);

  const pages = studyPdfThumbnailPages(node);
  pages.forEach((page, index) => {
    const thumbnail = document.createElement("div");
    thumbnail.className = "study-pdf-thumbnail";
    if (index === 0) thumbnail.classList.add("is-active");
    thumbnail.setAttribute("role", "button");
    thumbnail.setAttribute("tabindex", "0");
    thumbnail.setAttribute("aria-label", `Preview page ${page}`);
    thumbnail.dataset.studyPreviewPage = String(page);

    const frame = document.createElement("div");
    frame.className = "study-pdf-thumbnail-frame";

    const iframe = document.createElement("iframe");
    iframe.src = studyPdfEmbedSrc(node, page, 55);
    iframe.title = `${node.name}, page ${page}`;
    iframe.setAttribute("tabindex", "-1");
    frame.appendChild(iframe);

    thumbnail.appendChild(frame);
    thumbnail.appendChild(studyCreateText("study-pdf-thumbnail-label", `Page ${page}`));
    thumbnails.appendChild(thumbnail);
  });

  const setPage = (page, thumbnail) => {
    mainIframe.src = studyPdfEmbedSrc(node, page);
    thumbnails.querySelectorAll(".study-pdf-thumbnail").forEach((item) => {
      item.classList.toggle("is-active", item === thumbnail);
    });
  };

  thumbnails.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-study-preview-page]");
    if (!thumbnail || !thumbnails.contains(thumbnail)) return;
    setPage(Number(thumbnail.dataset.studyPreviewPage), thumbnail);
  });

  thumbnails.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const thumbnail = event.target.closest("[data-study-preview-page]");
    if (!thumbnail || !thumbnails.contains(thumbnail)) return;
    event.preventDefault();
    setPage(Number(thumbnail.dataset.studyPreviewPage), thumbnail);
  });

  wrapper.appendChild(thumbnails);
  wrapper.appendChild(main);
  return wrapper;
};

const studyRenderPreview = () => {
  if (!studyPreviewBody || !studyPreviewTitle || !studyPreviewIcon) return;
  const selected = studyGetSelectedEntry();
  const canOpenPdf = selected && studyIsPdf(selected.node) && Boolean(selected.node.path);

  studyPreviewIcon.src = selected ? studyIconForNode(selected.node) : STUDY_ICONS.folderOpen;
  studyPreviewTitle.textContent = selected ? selected.node.name : "Study Resources";

  if (canOpenPdf) {
    studyPreviewBody.replaceChildren(studyRenderPdfPreview(selected.node));
  } else {
    const selectedFolder = selected && studyIsFolder(selected.node) ? selected.node : null;
    const message =
      selectedFolder && selectedFolder.children && selectedFolder.children.length
        ? "Select a course folder or PDF resource to preview it here."
        : "No PDFs are available in this folder yet.";
    studyPreviewBody.replaceChildren(studyCreateEmpty(message, "study-preview-empty"));
  }

  if (studyOpenWindow) studyOpenWindow.disabled = !canOpenPdf;
  if (studyOpenTab) studyOpenTab.disabled = !canOpenPdf;
  if (studyDownload) studyDownload.disabled = !canOpenPdf;
};

const studyRenderStatus = () => {
  const selected = studyGetSelectedEntry();
  const browseEntry =
    selected && studyIsFolder(selected.node)
      ? selected
      : studyGetParentEntry(selected) || studyGetEntry(studyResourcesRoot.id);
  const count =
    browseEntry && browseEntry.node.children ? browseEntry.node.children.length : 0;
  if (studyAddress) studyAddress.textContent = studyPathText(selected);
  if (studyStatusLeft) {
    studyStatusLeft.textContent = `${studyObjectCountText(count)}, ${studyStorageText(browseEntry.node)}`;
  }
  if (studyStatusRight) studyStatusRight.textContent = studyPathText(selected);
  if (studyUp) studyUp.disabled = !selected || !selected.parentId;
};

const studyRenderViewButtons = () => {
  [
    [studyListView, "list"],
    [studyGalleryView, "gallery"],
  ].forEach(([button, mode]) => {
    if (!button) return;
    const isActive = studyState.viewMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

function studyRender() {
  studyRenderTree();
  studyRenderFilePane();
  studyRenderPreview();
  studyRenderStatus();
  studyRenderViewButtons();
}

if (studyTree && studyFilePane) {
  studyRebuildIndex();
  studyRender();
  studyLoadManifest();

  studyTree.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-study-toggle]");
    if (toggle && studyTree.contains(toggle)) {
      studyToggleFolder(toggle.getAttribute("data-study-toggle"));
      return;
    }

    const item = event.target.closest("[data-study-select]");
    if (item && studyTree.contains(item)) {
      const id = item.getAttribute("data-study-select");
      const entry = studyGetEntry(id);
      if (event.detail > 1 && entry && studyIsFolder(entry.node)) {
        studyState.expandedIds.add(id);
        studySetSelected(id);
        return;
      }
      studySetSelected(id);
    }
  });

  studyTree.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-study-select]");
    if (!item) return;
    const id = item.getAttribute("data-study-select");
    const entry = studyGetEntry(id);
    if (entry && studyIsFolder(entry.node)) {
      studyState.expandedIds.add(id);
      studySetSelected(id);
    }
  });

  studyFilePane.addEventListener("click", (event) => {
    const item = event.target.closest("[data-study-file]");
    if (!item || !studyFilePane.contains(item)) return;
    const id = item.getAttribute("data-study-file");
    const entry = studyGetEntry(id);
    if (event.detail > 1 && entry) {
      if (studyIsFolder(entry.node)) {
        studyState.expandedIds.add(id);
        studySetSelected(id);
        return;
      }
      studySetSelected(id);
      studyOpenSelectedInWindow();
      return;
    }
    studySetSelected(id);
  });

  studyFilePane.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-study-file]");
    if (!item) return;
    const id = item.getAttribute("data-study-file");
    const entry = studyGetEntry(id);
    if (!entry) return;
    if (studyIsFolder(entry.node)) {
      studyState.expandedIds.add(id);
      studySetSelected(id);
      return;
    }
    studySetSelected(id);
    studyOpenSelectedInWindow();
  });

  if (studyUp) {
    studyUp.addEventListener("click", () => {
      const parent = studyGetParentEntry(studyGetSelectedEntry());
      if (parent) studySetSelected(parent.node.id);
    });
  }

  [
    [studyListView, "list"],
    [studyGalleryView, "gallery"],
  ].forEach(([button, mode]) => {
    if (!button) return;
    button.addEventListener("click", () => {
      studyState.viewMode = mode;
      studyRender();
    });
  });

  [
    [studyOpenWindow, studyOpenSelectedInWindow],
    [studyOpenTab, studyOpenSelectedInTab],
    [studyDownload, studyDownloadSelected],
  ].forEach(([button, handler]) => {
    if (button) button.addEventListener("click", handler);
  });
}
})();