// The idea with this file is to make it webpackable for the style guide

const { bindActionCreators } = require('redux');
const Backbone = require('../../ts/backbone');
const Crypto = require('./crypto');
const Data = require('./data');
const Notifications = require('../../ts/notifications');
const OS = require('../../ts/OS');
const Util = require('../../ts/util');
const AttachmentDownloads = require('./attachment_downloads');
const ID = require('./id');

// Components
const { Avatar } = require('../../ts/components/Avatar');
const {
  AttachmentList,
} = require('../../ts/components/conversation/AttachmentList');
const { CaptionEditor } = require('../../ts/components/CaptionEditor');
const {
  ContactDetail,
} = require('../../ts/components/conversation/ContactDetail');
const { ContactListItem } = require('../../ts/components/ContactListItem');
const { ContactName } = require('../../ts/components/conversation/ContactName');
const {
  ConversationHeader,
} = require('../../ts/components/conversation/ConversationHeader');
const {
  EmbeddedContact,
} = require('../../ts/components/conversation/EmbeddedContact');
const {
  GroupNotification,
} = require('../../ts/components/conversation/GroupNotification');
const { Lightbox } = require('../../ts/components/Lightbox');
const { LightboxGallery } = require('../../ts/components/LightboxGallery');
const {
  MediaGallery,
} = require('../../ts/components/conversation/media-gallery/MediaGallery');
const { Message } = require('../../ts/components/conversation/Message');
const { MessageBody } = require('../../ts/components/conversation/MessageBody');
const {
  MessageDetail,
} = require('../../ts/components/conversation/MessageDetail');
const { Quote } = require('../../ts/components/conversation/Quote');
const {
  ResetSessionNotification,
} = require('../../ts/components/conversation/ResetSessionNotification');
const {
  TipsNotification,
} = require('../../ts/components/conversation/TipsNotification');
const {
  SafetyNumberNotification,
} = require('../../ts/components/conversation/SafetyNumberNotification');
const {
  TimerNotification,
} = require('../../ts/components/conversation/TimerNotification');
const {
  TypingBubble,
} = require('../../ts/components/conversation/TypingBubble');
const {
  VerificationNotification,
} = require('../../ts/components/conversation/VerificationNotification');
const { SearchInput } = require('../../ts/components/SearchInput');
const { SelectContactUser } = require('../../ts/components/SelectContactUser');

const {
  GroupContactCollect,
} = require('../../ts/components/GroupContactCollect');

const { BotContactCollect } = require('../../ts/components/BotContactCollect');

const {
  CommonHeader,
} = require('../../ts/components/conversation/CommonHeader');

const {
  SelectActionBar,
} = require('../../ts/components/conversation/SelectActionBar');

const {
  RecallMessageNotification,
} = require('../../ts/components/conversation/RecallMessageNotification');

const {
  TranslateMenu,
} = require('../../ts/components/conversation/TranslateMenu');

const {
  ConfidentialModeButton,
} = require('../../ts/components/conversation/ConfidentialModeButton');

const {
  FriendRequestOption,
} = require('../../ts/components/conversation/FriendRequestOption');

const {
  TopicListDialog,
} = require('../../ts/components/topic-list/TopicListDialog');

const {
  TranslateChangeNotification,
} = require('../../ts/components/conversation/TranslateChangeNotification');

const {
  MessageExpiryNotification,
} = require('../../ts/components/conversation/MessageExpiryNotification');

const {
  RemindCycleNotification,
} = require('../../ts/components/conversation/RemindCycleNotification');

const {
  ReminderNotification,
} = require('../../ts/components/conversation/ReminderNotification');

const {
  TipsForArchiveIndicator,
} = require('../../ts/components/conversation/TipsForArchiveIndicator');

const {
  AtPersonSelect,
} = require('../../ts/components/conversation/AtPersonSelect');

const {
  ImageGallery,
} = require('../../ts/components/image-gallery/ImageGallery');

const { EmojiSelect } = require('../../ts/components/conversation/EmojiSelect');

const { ForwardDialog } = require('../../ts/components/ForwardDialog');

const { JoinGroup } = require('../../ts/components/JoinGroup');
const {
  SettingDialog,
} = require('../../ts/components/conversation/settings/SettingDialog');

const { LocalSearch } = require('../../ts/components/local-search/LocalSearch');

const { Register } = require('../../ts/components/Register');

const {
  ConversationLodingView,
} = require('../../ts/components/conversation/ConversationLoadingView');
const { DateSeparator } = require('../../ts/components/DateSeparator');
const {
  StickyDateSeparator,
} = require('../../ts/components/StickyDateSeparator');
const { FloatingBar } = require('../../ts/components/call/FloatingBar');

const {
  AtPersonButton,
  SelectEmojiButton,
  UploadAttachmentButton,
  CreateTopicListButton,
  SearchChatHistoryButton,
  CallButton,
  CaptureAudioButton,
  VisibleReplyButton,
  InVisibleReplyButton,
  QuickGroupButton,
  ShareContactButton,
} = require('../../ts/components/ComposeButtons');

const {
  ScreenshotNotification,
} = require('../../ts/components/conversation/ScreenshotNotification');
const {
  IdentityKeyResetNotification,
} = require('../../ts/components/conversation/IdentityKeyResetNotification');
const { Login } = require('../../ts/components/account/Login/index');
const { LottieAnimation } = require('../../ts/components/LottieAnimation');
const {
  ForwardedMessageList,
} = require('../../ts/components/conversation/ForwardedMessageList');
const {
  LastSeenIndicator,
} = require('../../ts/components/conversation/LastSeenIndicator');
const { Prompt } = require('../../ts/components/shared/Prompt');
const {
  ScrollDownButton,
} = require('../../ts/components/conversation/ScrollDownButton');

// State
const { createContactPane } = require('../../ts/state/roots/createContactPane');
const { createFirstPane } = require('../../ts/state/roots/createFirstPane');
const { createLeftPane } = require('../../ts/state/roots/createLeftPane');
const { createStore } = require('../../ts/state/createStore');
const conversationsDuck = require('../../ts/state/ducks/conversations');
const userDuck = require('../../ts/state/ducks/user');

// Types
const AttachmentType = require('./types/attachment');
const VisualAttachment = require('./types/visual_attachment');
const Contact = require('../../ts/types/Contact');
const Conversation = require('./types/conversation');
const Errors = require('./types/errors');
const MediaGalleryMessage = require('../../ts/components/conversation/media-gallery/types/Message');
const MessageType = require('./types/message');
const MIME = require('../../ts/types/MIME');
const PhoneNumber = require('../../ts/types/PhoneNumber');
const SettingsType = require('../../ts/types/Settings');
const Mentions = require('../../ts/types/Mentions');
const APIStatus = require('../../ts/types/APIStatus');

// Views
const Initialization = require('./views/initialization');

// Workflow
const { IdleDetector } = require('./idle_detector');
const MessageDataMigrator = require('./messages_data_migrator');

const { createDomainSelector } = require('../../ts/web_api/endpoint-selector');
const { generateServiceConfig } = require('../../ts/web_api/service-generator');
const { getCallServiceUrls } = require('../../ts/web_api/call-service');

function initializeMigrations({
  userDataPath,
  getRegionCode,
  Attachments,
  Type,
  VisualType,
  logger,
}) {
  if (!Attachments) {
    return null;
  }
  const {
    getPath,
    createReader,
    createAbsolutePathGetter,
    createWriterForNew,
    createWriterForExisting,
  } = Attachments;
  const {
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
  } = VisualType;

  const attachmentsPath = getPath(userDataPath);
  const readAttachmentData = createReader(attachmentsPath);
  const loadAttachmentData = Type.loadData(readAttachmentData);
  const loadQuoteData = MessageType.loadQuoteData(loadAttachmentData);
  const getAbsoluteAttachmentPath = createAbsolutePathGetter(attachmentsPath);
  const deleteOnDisk = Attachments.createDeleter(attachmentsPath);
  const writeNewAttachmentData = createWriterForNew(attachmentsPath);
  const loadForwardContextData =
    MessageType.loadForwardContextData(loadAttachmentData);

  return {
    attachmentsPath,
    deleteAttachmentData: deleteOnDisk,
    deleteExternalMessageFiles: MessageType.deleteAllExternalFiles({
      deleteAttachmentData: Type.deleteData(deleteOnDisk),
      deleteOnDisk,
    }),
    getAbsoluteAttachmentPath,
    loadAttachmentData,
    loadQuoteData,
    loadMessage: MessageType.createAttachmentLoader(loadAttachmentData),
    readAttachmentData,
    processNewAttachment: async attachment =>
      await MessageType.processNewAttachment(attachment, {
        writeNewAttachmentData,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
      }),
    upgradeMessageSchema: (message, options = {}) => {
      const { maxVersion } = options;

      return MessageType.upgradeSchema(message, {
        writeNewAttachmentData,
        getRegionCode,
        getAbsoluteAttachmentPath,
        makeObjectUrl,
        revokeObjectUrl,
        getImageDimensions,
        makeImageThumbnail,
        makeVideoScreenshot,
        logger,
        maxVersion,
        deleteAttachmentData: deleteOnDisk,
        loadAttachmentData,
      });
    },
    writeMessageAttachments: MessageType.createAttachmentDataWriter({
      writeExistingAttachmentData: createWriterForExisting(attachmentsPath),
      logger,
    }),
    writeNewAttachmentData: createWriterForNew(attachmentsPath),
    loadForwardContextData,
  };
}

exports.setup = (options = {}) => {
  const { Attachments, userDataPath, getRegionCode, logger } = options;

  const Migrations = initializeMigrations({
    userDataPath,
    getRegionCode,
    Attachments,
    Type: AttachmentType,
    VisualType: VisualAttachment,
    logger,
  });

  const Components = {
    Avatar,
    AttachmentList,
    CaptionEditor,
    ContactDetail,
    ContactListItem,
    ContactName,
    ConversationHeader,
    EmbeddedContact,
    GroupNotification,
    Lightbox,
    LightboxGallery,
    MediaGallery,
    Message,
    MessageBody,
    MessageDetail,
    Quote,
    ResetSessionNotification,
    TipsNotification,
    SafetyNumberNotification,
    TimerNotification,
    Types: {
      Message: MediaGalleryMessage,
    },
    TypingBubble,
    VerificationNotification,
    SearchInput,
    SelectContactUser,
    GroupContactCollect,
    BotContactCollect,
    CommonHeader,
    SelectActionBar,
    RecallMessageNotification,
    MessageExpiryNotification,
    RemindCycleNotification,
    ReminderNotification,
    TipsForArchiveIndicator,
    TranslateMenu,
    ConfidentialModeButton,
    FriendRequestOption,
    TopicListDialog,
    TranslateChangeNotification,
    AtPersonSelect,
    ImageGallery,
    EmojiSelect,
    ForwardDialog,
    JoinGroup,
    SettingDialog,
    LocalSearch,
    AtPersonButton,
    SelectEmojiButton,
    UploadAttachmentButton,
    CreateTopicListButton,
    SearchChatHistoryButton,
    CallButton,
    CaptureAudioButton,
    VisibleReplyButton,
    InVisibleReplyButton,
    QuickGroupButton,
    ShareContactButton,
    Register,
    ConversationLodingView,
    ScreenshotNotification,
    IdentityKeyResetNotification,
    Login,
    DateSeparator,
    StickyDateSeparator,
    FloatingBar,
    LottieAnimation,
    ForwardedMessageList,
    LastSeenIndicator,
    Prompt,
    ScrollDownButton,
  };

  const Roots = {
    createContactPane,
    createFirstPane,
    createLeftPane,
  };
  const Ducks = {
    conversations: conversationsDuck,
    user: userDuck,
  };
  const State = {
    bindActionCreators,
    createStore,
    Roots,
    Ducks,
  };

  const Types = {
    Attachment: AttachmentType,
    Contact,
    Conversation,
    Errors,
    Message: MessageType,
    MIME,
    PhoneNumber,
    Settings: SettingsType,
    VisualAttachment,
    Mentions,
    APIStatus,
  };

  const Views = {
    Initialization,
  };

  const Workflow = {
    IdleDetector,
    MessageDataMigrator,
  };

  const Network = {
    createDomainSelector,
    generateServiceConfig,
    getCallServiceUrls,
  };

  return {
    AttachmentDownloads,
    Backbone,
    Components,
    Crypto,
    Data,
    Migrations,
    Notifications,
    OS,
    State,
    Types,
    Util,
    Views,
    Workflow,
    ID,
    Network,
  };
};
