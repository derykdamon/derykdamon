export const places = [
  {
    id: 'harlingen', number: '01', name: 'Harlingen', title: 'Your Valley beginning.',
    category: 'THE GATEWAY', coordinates: [-97.6544, 26.2285], coordinateLabel: '26.23° N / 97.65° W',
    image: '/aviation/harlingen-aerial-1600.webp', alt: 'Aerial photograph of northern Harlingen taken after departing Valley International Airport',
    text: 'A South Texas home base. Our aviation concept starts here, with flight requests and a vision for workspace, aircraft care, and a more considered arrival.',
    caption: 'Northern Harlingen, photographed on departure from HRL · 2022',
    author: 'RobertKixmiller', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Aerial_View_Of_The_Northern_Part_Of_Harlingen,_TX_08202022_1.jpg',
    link: '/aviation/request?service=flight&step=details', action: 'Start at HRL',
  },
  {
    id: 'padre', number: '02', name: 'South Padre Island', title: 'Let the coast set the pace.',
    category: 'THE COAST', coordinates: [-97.166, 26.118], coordinateLabel: '26.12° N / 97.17° W',
    image: '/aviation/padre-1600.webp', alt: 'South Padre Island beach with dunes, a boardwalk, and kites above the Gulf',
    text: 'Dunes, sea air, and an open horizon. Share your island destination and arrival preferences as part of a car-service inquiry.',
    caption: 'South Padre Island beach · 2022', author: 'Spheroidite', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:South_Padre_Island_beach_panorama.jpg',
    link: '/aviation/request?service=car&step=details', action: 'Plan your arrival',
  },
  {
    id: 'laguna', number: '03', name: 'Laguna Atascosa', title: 'A different kind of escape.',
    category: 'THE WILD', coordinates: [-97.385, 26.284], coordinateLabel: '26.28° N / 97.39° W',
    image: '/aviation/laguna-inlet-1600.webp', alt: 'Palms and cactus beside an inlet at Laguna Atascosa National Wildlife Refuge',
    text: 'The quieter side of the Valley: coastal habitat and wide-open skies at Laguna Atascosa National Wildlife Refuge. An invitation to explore the region beyond the runway.',
    caption: 'Laguna Atascosa National Wildlife Refuge · USFWS · 2003',
    author: 'U.S. Fish and Wildlife Service', license: 'Public domain / CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Laguna_Atascosa_NWR_inlet_(5121525224).jpg',
    link: 'https://www.fws.gov/refuge/laguna-atascosa', action: 'Explore the refuge',
  },
] as const

export const projectPoint = (coordinates: readonly number[]) => [
  (coordinates[0] + 97.5) * 6,
  (coordinates[1] - 26.235) * 6.7,
] as const
