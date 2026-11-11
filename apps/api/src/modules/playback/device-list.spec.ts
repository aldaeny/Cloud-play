import { PlaybackController } from './playback.controller';
import type { PrismaService } from '../../prisma.service';
import type { PlaybackService } from './playback.service';
import type { UserRequest } from '../../common/permissions.decorator';
describe('Playback device selector',()=>{
  it('lists only owned non-revoked devices with bounded non-secret projection',async()=>{
    const rows=[{id:'owned',deviceName:'Synthetic',platform:'web'}];
    const findMany=jest.fn().mockResolvedValue(rows);
    const controller=new PlaybackController({} as PlaybackService,{device:{findMany}} as unknown as PrismaService);
    expect(await controller.devices({id:'viewer'} as UserRequest)).toEqual(rows);
    expect(findMany).toHaveBeenCalledWith({where:{userId:'viewer',revokedAt:null},select:{id:true,deviceName:true,platform:true},take:50});
  });
});
