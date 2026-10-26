// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

const repoUrl = 'https://github.com/harieshwar-ai/node-jhora';

/** @type {import('@astrojs/starlight').StarlightUserConfig} */
const starlightConfig = {
	title: 'Node-Jhora',
	description: 'Vedic astrology (Jyotish) engine documentation for the Node-Jhora monorepo.',
	logo: { src: './src/assets/logo.svg', replacesTitle: false },
	editLink: {
		baseUrl: `${repoUrl}/edit/main/`,
	},
	social: [
		{ icon: 'github', label: 'GitHub', href: repoUrl },
	],
	customCss: ['./src/styles/custom.css'],
	plugins: [
		starlightLinksValidator({
			failOnError: true,
			errorOnRelativeLinks: false,
			exclude: ['/api-reference{,/**/*}'],
			reporters: { githubActions: true, json: false },
		}),
	],
	sidebar: [
		{ label: 'Getting started', slug: 'getting-started' },
		{
			label: 'Guides',
			items: [{ autogenerate: { directory: 'guides' } }],
		},
		{
			label: 'Catalogues',
			items: [
				{ label: 'Ayanamsas', slug: 'catalogues/ayanamsas' },
				{ label: 'Vargas (stub)', slug: 'catalogues/vargas' },
				{ label: 'Dasas (stub)', slug: 'catalogues/dasas' },
				{ label: 'Yogas (stub)', slug: 'catalogues/yogas' },
			],
		},
		{ label: 'API reference', slug: 'api' },
	],
};

export default defineConfig({
	outDir: 'dist',
	integrations: [starlight(starlightConfig)],
});
