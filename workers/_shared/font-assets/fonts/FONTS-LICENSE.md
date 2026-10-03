# FONTS-LICENSE

Self-hosted web fonts served from each Worker's own static assets (`/fonts/`),
replacing requests to fonts.googleapis.com / fonts.gstatic.com (CFD-194, privacy).

## Plus Jakarta Sans

- Font name: Plus Jakarta Sans (designer: Tokotype)
- Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)
- License: SIL Open Font License, Version 1.1 (OFL-1.1). Full text below.
- Upstream: https://github.com/tokotype/PlusJakartaSans
- Google Fonts listing: https://fonts.google.com/specimen/Plus+Jakarta+Sans
- License text source: https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt
- Styles/weights used: normal 400, 500, 600, 700; italic 400 (variable `wght` font,
  one file per style and subset; Google serves the same file for every normal weight).
- Subsets: latin, latin-ext, vietnamese, cyrillic-ext (loaded on demand via `unicode-range`).
- CSS API source (fetched 2026-10-03 with a Chrome 141 user agent):
  - https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap
  - https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap (subset of the above; same files)

The files are unmodified (renamed only); `plus-jakarta-sans.css` is the Google CSS
with `src` URLs rewritten to `/fonts/...` and `font-display: swap`.

| File | Bytes | SHA-256 | Source URL |
| --- | ---: | --- | --- |
| `plus-jakarta-sans-italic-cyrillic-ext.woff2` | 1048 | `4970f7e484700a2518beef5c5e56cf6be336d464ac72dd7a50ad4a5163eafd84` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCS_aOKyYRw.woff2 |
| `plus-jakarta-sans-italic-latin-ext.woff2` | 11140 | `8bdc0f1b580aa381668eac662c2ea4a39efabef8225987d8f7b4865120617f27` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCS_ZOKyYRw.woff2 |
| `plus-jakarta-sans-italic-latin.woff2` | 12592 | `e3d33148aa32c737949f4f91a0a3ef014792be66c61539455c492ec2cd4796e6` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCS_XOKw.woff2 |
| `plus-jakarta-sans-italic-vietnamese.woff2` | 4332 | `54737a23b85d7b05bfb9796bb7e5da32ae17e1f4258ed92c2c2ab4ae5973faaf` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIZaomQNQcsA88c7O9yZ4KMCoOg4KozySKCdSNG9OcqYQ0lCS_YOKyYRw.woff2 |
| `plus-jakarta-sans-normal-cyrillic-ext.woff2` | 1716 | `c46a510ab43925a55ecfe6c2d5fad0ce1902cd48ab276621d41f7afa42e4daee` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko70yyygA.woff2 |
| `plus-jakarta-sans-normal-latin-ext.woff2` | 21728 | `38e3b8fd8045048eb311d90170a4429ed2c8f405852dc3d91b5af8452758703f` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yyygA.woff2 |
| `plus-jakarta-sans-normal-latin.woff2` | 27348 | `153fc85b70298beeb1d61a5f723331649e7f23bb77302a66e61cb3e2fbdb5e79` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2 |
| `plus-jakarta-sans-normal-vietnamese.woff2` | 8352 | `b275d1258601dda240fc6a1d4a6cad56e691d898f5cdf1b0e4fd6ca0022d8e40` | https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko50yyygA.woff2 |

## SIL Open Font License 1.1 (verbatim)

```
Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
