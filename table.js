import "dotenv/config";
import { Client } from "@notionhq/client";
import util from "util";
import fetch from "node-fetch";

const notion = new Client({ auth: process.env.NOTION_KEY });
const THE_YEAR = "2022";

const removeDuplicatesFromArray = (array) => {
  return array.filter((item, index) => array.indexOf(item) === index);
};

const getPagedata = async () => {
  return await notion.databases.query({
    database_id: process.env.NOTION_ORIGIN_DATABASE_ID,
  });
};

const getLatestSprint = async (pageData) => {
  const allSprintsArrayWithDuplicates = pageData.results.map((result) => {
    if (result.properties.Sprint) {
      return result.properties.Sprint.select.name;
    }
  });
  const allSprintsArrayNoDuplicates = removeDuplicatesFromArray(
    allSprintsArrayWithDuplicates
  );
  const allSprintsArrayNoDuplicatesNoUndefined =
    allSprintsArrayNoDuplicates.filter((e) => e !== undefined);

  const allSprintsArrayOfThisYear =
    allSprintsArrayNoDuplicatesNoUndefined.filter(
      (e) => e.substring(e.length - 5, e.length - 1) === THE_YEAR
    );

  const sortedAllSprintsArrayOfThisYear = allSprintsArrayOfThisYear.sort(
    (a, b) => {
      return (
        Number(b.substring(b.length - 9, b.length - 7)) -
        Number(a.substring(a.length - 9, a.length - 7))
      );
    }
  );
  const latestSprint = sortedAllSprintsArrayOfThisYear[0];

  return latestSprint;
};

const getAllUsersWithTheirInfo = async (pageData) => {
  const allUsersWithAllTheirInfo = await pageData.results.map((result) => {
    const ownerNameGenerator = (input) => {
      if (input.multi_select[0] === undefined) {
        return "N/A";
      } else {
        return input.multi_select[0].name;
      }
    };

    const sprintOrStatusNameGenerator = (input) => {
      if (input === undefined) {
        return "N/A";
      } else {
        return input.select.name;
      }
    };

    return {
      taskId: result.id,
      owner: ownerNameGenerator(result.properties.Owner),
      sprint: sprintOrStatusNameGenerator(result.properties.Sprint),
      gap: result.properties.gap ? result.properties.gap.number : "N/A",
      //   status: sprintOrStatusNameGenerator(result.properties.Status),
    };
  });
  return allUsersWithAllTheirInfo;
};

const getDataOfOnlyLatestSprint = async (
  latestSprint,
  allUsersWithAllTheirInfo
) => {
  const dataArrayOfOnlyLatestSprint = allUsersWithAllTheirInfo.filter(
    (ele) => ele.sprint === latestSprint
  );
  return dataArrayOfOnlyLatestSprint;
};

const getUserArray = async (dataOfOnlyLatestSprint) => {
  const unfilteredUserArray = dataOfOnlyLatestSprint.map((ele) => {
    return ele.owner;
  });
  const userArray = removeDuplicatesFromArray(unfilteredUserArray);
  return userArray;
};

const getTasksPerUser = async (userArray, dataOfOnlyLatestSprint) => {
  const tasksPerUser = userArray.map((user) => {
    let singleUserTasksObject = {
      name: user,
      score: 0,
      timeGaps: [],
    };

    dataOfOnlyLatestSprint.forEach((task) => {
      if (task.userId === user.userId) {
        singleUserTasksObject.timeGaps.push(task.gap);
        singleUserTasksObject.score += task.gap;
      }
    });
    return singleUserTasksObject;
  });
  return tasksPerUser;
};

const arrayOfEntriesGenerator = async (tasksPerUser) => {
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

  const arrayOfAllEntries = tasksPerUser.map((entry) => {
    return {
      Name: {
        title: [
          {
            text: {
              content: entry.name,
            },
          },
        ],
      },
      Score: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: scoreNotZeroValidator(entry.score),
            },
          },
        ],
      },
      timeGaps: {
        type: "rich_text",
        rich_text: [
          {
            text: {
              content: timeGapsNotEmptyValidator(entry.timeGaps),
            },
          },
        ],
      },
    };
  });
  return arrayOfAllEntries;
};

const entryAdder = async (sprintId, arrayOfAllEntries) => {
  await arrayOfAllEntries.forEach((entry) => addSingleEntry(sprintId, entry));
};

const addSingleEntry = async (sprintId, entry) => {
  try {
    const response = await notion.pages.create({
      parent: {
        database_id: sprintId,
      },
      properties: entry,
    });
    console.log(response);
    console.log("Success! Entry added.");
  } catch (error) {
    console.error(error);
  }
};

const theFunction = async () => {
  const pageData = await getPagedata();
  const latestSprint = await getLatestSprint(pageData);
  const allUsersWithAllTheirInfo = await getAllUsersWithTheirInfo(pageData);
  const dataOfOnlyLatestSprint = await getDataOfOnlyLatestSprint(
    latestSprint,
    allUsersWithAllTheirInfo
  );
  const userArray = await getUserArray(dataOfOnlyLatestSprint);
  const tasksPerUser = await getTasksPerUser(userArray, dataOfOnlyLatestSprint);
  const arrayOfAllEntries = await arrayOfEntriesGenerator(tasksPerUser);

  const doesSprintAlreadyExist = await checkIfSprintTableAlreadyExists(
    latestSprint
  );
  if (!doesSprintAlreadyExist) {
    const sprintId = await createSprintDBTemplate(latestSprint);
    await entryAdder(sprintId, arrayOfAllEntries);
    return "successfully done stuff";
  } else {
    return `${latestSprint} already exists.`;
  }
};

const checkIfSprintTableAlreadyExists = async (latestSprint) => {
  const response = await notion.search({
    query: latestSprint,
    sort: {
      direction: "ascending",
      timestamp: "last_edited_time",
    },
  });

  if (response.results.length) {
    console.log(
      `${latestSprint} already exists in ${response.results[0].url}. Aborting process.`
    );
    return true;
  } else {
    console.log(`${latestSprint} DOES NOT exist. Creating sprint database.`);
    return false;
  }
};

const createSprintDBTemplate = async (latestSprint) => {
  const page = await notion.pages.retrieve({
    page_id: process.env.NOTION_ALL_SPRINT_LIST_PAGE_ID,
  });

  const body = {
    parent: {
      type: "page_id",
      page_id: page.id,
    },
    title: [
      {
        type: "text",
        text: {
          content: latestSprint,
          link: null,
        },
      },
    ],
    properties: {
      Name: {
        title: {},
      },
      Score: {
        rich_text: {},
      },
      timeGaps: {
        rich_text: {},
      },
    },
  };

  const options = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Notion-Version": "2022-02-22",
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NOTION_KEY}`,
    },
    body: JSON.stringify(body),
  };

  const result = await fetch("https://api.notion.com/v1/databases", options)
    .then((response) => response.json())
    .then((response) => {
      return response;
    })
    .catch((err) => {
      console.error(err);
    });

  const sprintId = result.id;
  return sprintId;
};

theFunction();
