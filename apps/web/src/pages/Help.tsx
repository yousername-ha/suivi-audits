import { Anchor, Card, Stack, Text, TextInput, Title } from '@mantine/core';
import { Page, PageHeader } from '@suivi/ui';
import { useState } from 'react';
import { HELP_ARTICLES, HELP_VERSION } from '../help';
import { useMe } from '../session';

const searchable = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
export function HelpPage() {
  const me = useMe();
  const [search, setSearch] = useState('');
  const permitted = HELP_ARTICLES.filter((a) => !a.permission || me.permissions.includes(a.permission));
  const articles = permitted.filter((a) =>
    searchable([a.title, ...a.steps].join(' ')).includes(searchable(search.trim())),
  );
  return (
    <Page>
      <PageHeader
        title="Guide d’utilisation"
        description={`Documentation ${HELP_VERSION} · Application ${me.version}`}
      />
      <Stack>
        <TextInput label="Rechercher dans le guide" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <Text size="sm" c="dimmed">
          Les fonctions disponibles dépendent de vos droits. Ce guide décrit les écrans livrés, pas une attestation de
          conformité.
        </Text>
        {articles.length === 0 && <Text role="status">Aucun article ne correspond à votre recherche.</Text>}
        {articles.map((article) => (
          <Card key={article.id} withBorder>
            <Stack gap="sm">
              <Title order={2} size="h4">
                {article.title}
              </Title>
              <ol>
                {article.steps.map((step) => (
                  <li key={step}>
                    <Text size="sm">{step}</Text>
                  </li>
                ))}
              </ol>
              <Anchor href={article.link}>Ouvrir le module</Anchor>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Page>
  );
}
