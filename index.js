import "dotenv/config";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_KEY });

const getPagedata = async () => {
  return await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
  });
};

const getAllUsersIdsAndNames = async () => {
  const allUsers = await notion.users.list({});
  const allUsersIds = allUsers.results.map((user) => {
    return {
      userId: user.id,
      name: user.name,
    };
  });
  return allUsersIds;
};

const getAllTasksIdsWithUserIds = async (pageData) => {
  const allTasksIdsWithUsersIds = pageData.results.map((result) => {
    return {
      taskId: result.id,
      userId: result.created_by.id,
      gap: result.properties.gap.number,
    };
  });

  return allTasksIdsWithUsersIds;
};

const getTasksPerUser = async (allUsersIdsAndNames, allTasksIdsWithUserIds) => {
  const tasksPerUser = allUsersIdsAndNames.map((user) => {
    let singleUserTasksObject = {
      name: user.name,
      userId: user.userId,
      score: 0,
      timeGaps: [],
    };

    allTasksIdsWithUserIds.forEach((task) => {
      if (task.userId === user.userId) {
        singleUserTasksObject.timeGaps.push(task.gap);
        singleUserTasksObject.score += task.gap;
      }
    });
    return singleUserTasksObject;
  });
  return tasksPerUser;
};

const theFunction = async () => {
  const pageData = await getPagedata();

  const allUsersIdsAndNames = await getAllUsersIdsAndNames();
  const allTasksIdsWithUserIds = await getAllTasksIdsWithUserIds(pageData);
  const tasksPerUser = await getTasksPerUser(
    allUsersIdsAndNames,
    allTasksIdsWithUserIds
  );
  return tasksPerUser;
};

const addEntry = async (entry) => {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: "5bcccede470b44e797c749cd03b3740b",
      },
      properties: entry,
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error(error.body);
  }
};

const timeGapsNotEmptyValidator = (timeGaps) => {
  if (timeGaps.join(",") === "") {
    return "N/A";
  } else {
    return timeGaps.join(",");
  }
};

const scoreNotZeroValidator = (score) => {
  if (score === 0) {
    return "N/A";
  } else {
    return (-1 * score).toString();
  }
};

const arrayOfAllEntriesGenerator = async () => {
  const tasksPerUser = await theFunction();
  const arrayOfAllEntries = tasksPerUser.map((taskPerUser) => {
    return {
      Name: {
        title: [
          {
            text: {
              content: taskPerUser.name,
            },
          },
        ],
      },
      UserID: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: taskPerUser.userId,
            },
          },
        ],
      },
      score: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: scoreNotZeroValidator(taskPerUser.score),
            },
          },
        ],
      },
      timeGaps: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: timeGapsNotEmptyValidator(taskPerUser.timeGaps),
            },
          },
        ],
      },
    };
  });
  return arrayOfAllEntries;
};

const entryAdder = async () => {
  const arrayOfAllEntries = await arrayOfAllEntriesGenerator();
  arrayOfAllEntries.forEach((entry) => {
    return addEntry(entry);
  });
};

entryAdder();
