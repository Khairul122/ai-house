import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { platformList } from "./platforms.js";
import { SocialService } from "./social.service.js";

@Controller("api/social")
export class SocialController {
  constructor(@Inject(SocialService) private readonly social: SocialService) {}

  @Get("platforms")
  platforms() {
    return platformList();
  }

  @Get("accounts")
  accounts() {
    return this.social.listAccounts();
  }

  @Post("accounts")
  addAccount(@Body() body: unknown) {
    return this.social.addAccount(body);
  }

  @Post("connect/tiktok/start")
  tiktokStart(@Body() body: unknown) {
    return this.social.tiktokConnectStart(body);
  }

  @Post("connect/tiktok/finish")
  tiktokFinish(@Body() body: { redirected?: string }) {
    return this.social.tiktokConnectFinish(body ?? {});
  }

  @Delete("accounts/:id")
  removeAccount(@Param("id") id: string) {
    return this.social.removeAccount(id);
  }

  @Get("posts")
  posts(@Query("projectId") projectId?: string) {
    return this.social.listPosts(projectId);
  }

  @Post("posts")
  createPost(@Body() body: unknown) {
    return this.social.createPost(body);
  }

  @Patch("posts/:id")
  updatePost(
    @Param("id") id: string,
    @Body() body: { accountId?: string | null; caption?: string },
  ) {
    return this.social.updatePost(id, body ?? {});
  }

  @Post("posts/:id/publish")
  publish(@Param("id") id: string) {
    return this.social.publish(id);
  }

  @Post("posts/:id/reject")
  reject(@Param("id") id: string) {
    return this.social.reject(id);
  }
}
