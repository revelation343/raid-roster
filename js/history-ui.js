import { loadHistory, loadVersion } from './api.js';

function relative(iso) {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString();
}

export async function renderHistory(root, onRestore) {
  root.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'empty';
  loading.textContent = 'Reading the change log…';
  root.append(loading);

  let commits;
  try {
    commits = await loadHistory();
  } catch (e) {
    loading.textContent = e.message;
    return;
  }

  root.replaceChildren();
  if (!commits.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No changes recorded yet.';
    root.append(p);
    return;
  }

  commits.forEach((c, i) => {
    const [subject, ...rest] = c.commit.message.split('\n');
    const details = rest.join('\n').trim().split('\n').filter(Boolean);

    const card = document.createElement('article');
    card.className = 'commit';
    card.style.animationDelay = `${Math.min(i, 12) * 0.03}s`;

    const who = document.createElement('div');
    who.className = 'who';
    const colon = subject.indexOf(':');
    if (colon > 0) {
      const em = document.createElement('em');
      em.textContent = subject.slice(0, colon);
      who.append(em, document.createTextNode(subject.slice(colon)));
    } else {
      who.textContent = subject;
    }

    const when = document.createElement('time');
    when.dateTime = c.commit.author.date;
    when.textContent = relative(c.commit.author.date);
    when.title = new Date(c.commit.author.date).toLocaleString();

    const restore = document.createElement('button');
    restore.className = 'ghost restore';
    restore.textContent = 'Restore';
    restore.onclick = async () => {
      if (!confirm(
        `Restore the roster as it was at "${subject}"?\n\n` +
        `This loads it into the editor — you still have to press Save.`)) return;
      restore.disabled = true;
      restore.textContent = 'Loading…';
      try {
        onRestore(await loadVersion(c.sha));
      } catch (e) {
        alert(e.message);
        restore.disabled = false;
        restore.textContent = 'Restore';
      }
    };

    card.append(who, restore, when);

    if (details.length) {
      const ul = document.createElement('ul');
      for (const d of details.slice(0, 20)) {
        const li = document.createElement('li');
        li.textContent = d;
        ul.append(li);
      }
      card.append(ul);
    }

    root.append(card);
  });
}
