'use strict';

const { idPath, nubboRequest } = require('./client');

const DOWNLOAD_LINK_SECONDS = 900;

const downloadLinkOf = (z, bundle, fileId, expiresIn) =>
  nubboRequest(z, bundle, {
    method: 'POST',
    path: `/v1/files/${idPath(fileId)}/download-link`,
    body: expiresIn ? { expiresIn } : {},
  });

const hydrateDownload = async (z, bundle) => {
  const link = await downloadLinkOf(z, bundle, bundle.inputData.fileId, DOWNLOAD_LINK_SECONDS);
  return z.stashFile(z.request({ url: link.url, raw: true }));
};

const withDownload = (z, item, fileId) =>
  fileId ? { ...item, downloadFile: z.dehydrateFile(hydrateDownload, { fileId }) } : item;

module.exports = { downloadLinkOf, hydrateDownload, withDownload };
