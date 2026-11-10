#!/usr/bin/env python3
"""Build content-addressed browser assets, including AudioWorklet dependencies."""
import hashlib
from pathlib import Path
import re
import argparse


def build(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    mapping = {}
    reference = re.compile(r'''(['"])(\./[^'"\n]+\.(?:js|json|svg)|app\.js|style\.css)\1''')

    def asset(relative):
        relative = Path(relative)
        if relative in mapping:
            return mapping[relative]
        path = source / relative
        content = path.read_text()
        if relative.suffix in ('.js', '.html'):
            def replace(match):
                target = (relative.parent / match.group(2))
                resolved = asset(target)
                # All current modules sit in the root; keep relative URL semantics.
                import os
                url = os.path.relpath(resolved, relative.parent).replace('\\', '/')
                if match.group(2).startswith('./'):
                    url = './' + url
                return match.group(1) + url + match.group(1)
            content = reference.sub(replace, content)
        digest = hashlib.sha256(content.encode()).hexdigest()[:12]
        output = relative if relative.name == 'index.html' else relative.with_name(relative.stem+'.'+digest+relative.suffix)
        (destination/output).parent.mkdir(parents=True, exist_ok=True)
        (destination/output).write_text(content)
        mapping[relative] = output
        return output

    asset(Path('index.html'))
    print('Built '+str(destination))
    for original, output in mapping.items():
        print(str(original)+' -> '+str(output))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='web')
    parser.add_argument('--output', default='dist')
    args = parser.parse_args()
    build(args.source, args.output)
