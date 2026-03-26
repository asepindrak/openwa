import Head from "next/head";

export function AppHead({ title = "OpenWA", description = "Self-hosted OpenWA dashboard untuk auth, session, dan chat management." }) {
  const fullTitle = title === "OpenWA" ? title : `${title} | OpenWA`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="theme-color" content="#111b21" />
      <link rel="icon" href="/favicon.ico" />
    </Head>
  );
}
