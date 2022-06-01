import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { DataSource } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";
import axios from "axios";
const app = express();

app.use(
  cors({
    origins: ["http://localhost:3000"],
  })
);

app.use(express.json());

let dataSource = new DataSource({
  type: "mongodb",
  host: "localhost",
  database: "main_microservice",
  synchronize: true,
  logging: false,
  // cli:{
  //     entitiesDir:"src/entity"
  // },
  entities: [Product],
});

dataSource
  .initialize()
  .then((db) => {
    const productRepository = db.getMongoRepository(Product);
    amqp.connect(
      "amqps://udmuktmn:gK0QvYKZ8CE9HrdkBmU3-Elfxfwmz4oY@sparrow.rmq.cloudamqp.com/udmuktmn",
      (err, connection) => {
        if (err) throw err;

        connection.createChannel((err, channel) => {
          if (err) throw err;
          channel.assertQueue("product_created", { durable: false });
          channel.assertQueue("product_updated", { durable: false });
          channel.assertQueue("product_deleted", { durable: false });
          channel.consume(
            "product_created",
            async (msg) => {
              const eventProduct: Product = JSON.parse(msg.content.toString());
              const product = new Product();
              product.admin_id = parseInt(eventProduct.id);
              product.title = eventProduct.title;
              product.image = eventProduct.image;
              product.likes = eventProduct.likes;

              await productRepository.save(product);
              console.log("Product Created");
            },
            { noAck: true }
          );
          channel.consume(
            "product_updated",
            async (msg) => {
              const eventProduct: Product = JSON.parse(msg.content.toString());
              const product = await productRepository.findOne({
                where: { admin_id: parseInt(eventProduct.id) },
              });
              productRepository.merge(product, {
                title: eventProduct.title,
                image: eventProduct.image,
                likes: eventProduct.likes,
              });
              await productRepository.save(product);
              console.log("Product Updated");
            },
            { noAck: true }
          );
          channel.consume(
            "product_deleted",
            async (msg) => {
              const admin_id = parseInt(msg.content.toString());
              await productRepository.deleteOne({ admin_id });
              console.log("Product Deleted");
            },
            { noAck: true }
          );

          app.get("/api/products", async (req: Request, res: Response) => {
            const products = await productRepository.find();
            return res.send(products);
          });

        //   app.post(
        //     "/api/products/:id/like",
        //     async (req: Request, res: Response) => {
        //       const product = await productRepository.findOne({
        //         where: {
        //           id: Object('6297c350c116f5b6a9a7a5fa'),
        //         },
        //       });
        //       console.log(product)

        //     //   await axios.post(
        //     //     `http://localhost:8000/api/products/${product.admin_id}/like`,
        //     //     {}
        //     //   );
        //       product.likes++
        //       await productRepository.save(product)
        //       return res.send(product)
        //     }
        //   );

          app.listen(8001, () => {
            console.log("Listening on 8001");
            console.log("DB Connected: ");
          });
          process.on("beforeExit", () => {
            console.log("closing");
            connection.close();
          });
        });
      }
    );
  })
  .catch((error) => console.log("DB Error: ", error));
