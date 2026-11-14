export type RootStackParamList = {
  Welcome: undefined;
  Dashboard: undefined;
  Capture: { albumId: string };
  Finish: { albumId: string; existing?: boolean };
  PhotoReview: { albumId: string; photoId: string };
};
