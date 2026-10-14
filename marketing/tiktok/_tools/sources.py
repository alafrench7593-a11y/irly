"""Writes SOURCES.md next to each post.json: every photo, its page and licence."""
import json, glob, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
idx = {e['file']: e for e in json.load(open(f'{root}/_photos/index.json'))}
CHECK = {'woman-window-night-city/03-pixabay-10203324.jpg': 'Vérifier sur la page que ce n’est pas une image générée par IA avant publication.'}
for p in sorted(glob.glob(f'{root}/*/*/post.json')):
    post = json.load(open(p))
    lines = ['# Sources des images', '', 'Toutes les photos viennent de Pixabay, sous la Pixabay Content License : usage commercial autorisé, sans attribution obligatoire, retouche autorisée.', 'Licence : https://pixabay.com/service/license-summary/', 'Interdit par la licence : vendre la photo telle quelle, laisser croire qu’une personne photographiée soutient IRLY, usage trompeur ou offensant des personnes visibles.', '']
    for i, s in enumerate(post['slides'], 1):
        if 'img' not in s:
            lines.append(f'- Slide {i:02d} : fond uni, aucune image.')
            continue
        e = idx[s['img']]
        lines.append(f'- Slide {i:02d} : {e["page"]} (photographe : {e["user"]}) — fichier `_photos/{s["img"]}`' + (f' — **{CHECK[s["img"]]}**' if s['img'] in CHECK else ''))
    open(os.path.join(os.path.dirname(p), 'SOURCES.md'), 'w').write('\n'.join(lines) + '\n')
    print('ok', p)
