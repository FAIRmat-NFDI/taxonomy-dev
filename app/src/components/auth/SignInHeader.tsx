import { Box, Stack, Typography } from '@mui/material';
import { images } from '@/assets';
import { logoRules } from '@/theme';
import { signInCopy, type SignInMode } from './signInConfig';

export function SignInHeader({ mode, titleId }: { mode: SignInMode; titleId: string }) {
  const copy = signInCopy[mode];
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
      <Box component="img" src={images.logo} alt="" sx={{ height: logoRules.minHeightPx * 1.5, mb: 1 }} />
      <Typography id={titleId} variant="h4" component="h2">
        {copy.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.subtitle}
      </Typography>
    </Stack>
  );
}
