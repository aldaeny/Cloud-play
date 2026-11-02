import type {GetStaticPaths,GetStaticProps} from 'next';
import SectionLayout from '../../src/components/layout/SectionLayout';
import OpenMovies,{movies} from '../../src/components/movies/OpenMovies';
export const getStaticPaths:GetStaticPaths=async()=>({paths:movies.map(movie=>({params:{id:movie.id}})),fallback:false});
export const getStaticProps:GetStaticProps=async context=>({props:{id:context.params?.id}});
export default function MovieDetails({id}:{id:string}){const movie=movies.find(x=>x.id===id);if(!movie)return null;return <SectionLayout title={{ar:movie.title,en:movie.title}}>{language=><OpenMovies language={language} onlyId={id}/>}</SectionLayout>}
