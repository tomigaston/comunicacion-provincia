export async function getServerSideProps() {
  return { redirect: { destination: '/localidades', permanent: false } };
}

export default function Index() {
  return null;
}
