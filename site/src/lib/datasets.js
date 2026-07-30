const paths = {
  morphology: './data/morphology.json',
  experiences: './data/experiences.json',
  references: './data/references.json',
};

const cache = new Map();

export async function loadDataset(name) {
  if (!paths[name]) throw new Error(`Unknown dataset: ${name}`);
  if (!cache.has(name)) {
    cache.set(name, fetch(paths[name]).then((response) => {
      if (!response.ok) throw new Error(`Could not load ${name} dataset.`);
      return response.json();
    }));
  }
  return cache.get(name);
}

export function evidenceBadge(datasetType) {
  return {
    observation: 'Measured / derived',
    experience: 'Reported / coded',
    reference_map: 'Referenced / interpreted',
  }[datasetType] || 'Unclassified';
}

export function sortedEntries(record) {
  return Object.entries(record || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}
