import { useLocalSearchParams } from 'expo-router';

import { CourseView } from '@/components/CourseView';
import { PACK_IDS } from '@/packs/registry';

/** Static web export: pre-render a page for every shipped pack. */
export function generateStaticParams(): { id: string }[] {
  return PACK_IDS.map((id) => ({ id }));
}

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CourseView packId={id} showBack />;
}
