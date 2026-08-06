const toggle = document.querySelector('#mobile-menu-toggle');
const navigation = document.querySelector('#primary-navigation');

function setMenu(open) {
  if (!toggle || !navigation) return;
  navigation.dataset.open = String(open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? 'Close menu' : 'Menu';
}

toggle?.addEventListener('click', () => {
  setMenu(navigation?.dataset.open !== 'true');
});

navigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenu(false);
    toggle?.focus();
  }
});

const desktop = globalThis.matchMedia?.('(min-width: 761px)');
desktop?.addEventListener?.('change', (event) => {
  if (event.matches) setMenu(false);
});
