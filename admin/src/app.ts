import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import { DataSource } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

const app = express();

app.use(
  cors({
    origins: ["http://localhost:3000"],
  })
);

let dataSource = new DataSource({
  type: "mysql",
  host: "localhost",
  database: "admin_microservice",
  username: "root",
  password: "rootroot",
  port: 3306,
  synchronize: true,
  logging: true,
  entities: [Product],
});
dataSource
  .initialize()
  .then((db) => {
    app.use(express.json());

    amqp.connect(
      "amqps://udmuktmn:gK0QvYKZ8CE9HrdkBmU3-Elfxfwmz4oY@sparrow.rmq.cloudamqp.com/udmuktmn",
      (err, connection) => {
        if (err) throw err;

        connection.createChannel((err, channel) => {
          if (err) throw err;

          const productRepository = db.getRepository(Product);

          app.get("/api/products", async (req: Request, res: Response) => {
            const products = await productRepository.find();
            res.json(products);
          });

          app.post("/api/products", async (req: Request, res: Response) => {
            const product = await productRepository.create(req.body);
            const result = await productRepository.save(product);
            channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)))
            return res.send(result);
          });

          app.get("/api/products/:id", async (req: Request, res: Response) => {
            let productId = req && req.params && req.params.id;
            const product = await productRepository.findOne({
              where: { id: parseInt(productId) },
            });
            return res.send(product);
          });

          app.put("/api/products/:id", async (req: Request, res: Response) => {
            let productId = req && req.params && req.params.id;
            const product = await productRepository.findOne({
              where: { id: parseInt(productId) },
            });
            productRepository.merge(product, req.body);
            const result = await productRepository.save(product);
            channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)))
            return res.send(result);
          });
          app.delete(
            "/api/products/:id",
            async (req: Request, res: Response) => {
              const result = await productRepository.delete(req.params.id);
              channel.sendToQueue('product_deleted', Buffer.from(req.params.id))
              return res.send(result);
            }
          );
          app.post(
            "/api/products/:id/like",
            async (req: Request, res: Response) => {
              let productId = req && req.params && req.params.id;
              const product = await productRepository.findOne({
                where: { id: parseInt(productId) },
              });
              product.likes++;
              const result = await productRepository.save(product);
              return res.send(result);
            }
          );
          app.listen(8000, () => {
            console.log("Listening on 8000");
            console.log("DB Connected: ");
          });
          process.on('beforeExit',()=>{
            console.log('closing');
            connection.close()
        })
        });
      }
    );
  })
  .catch((error) => console.log("DB Error: ", error));
//console.log('DataSource: ', dataSource)
